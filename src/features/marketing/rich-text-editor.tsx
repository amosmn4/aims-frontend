import { useEffect, useState, type ReactNode } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapParagraph from "@tiptap/extension-paragraph";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import {
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  BackgroundColor,
} from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Baseline,
  Highlighter,
  RemoveFormatting,
  TextQuote,
  Unlink,
  Table as TableIcon,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Must match RICH_TEXT_FONT_FAMILIES in backend common/sanitize.ts; multi-word names are pre-quoted CSS.
const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Arial", value: "Arial" },
  { label: "Helvetica", value: "Helvetica" },
  { label: "Verdana", value: "Verdana" },
  { label: "Tahoma", value: "Tahoma" },
  { label: "Trebuchet MS", value: '"Trebuchet MS"' },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: '"Times New Roman"' },
  { label: "Garamond", value: "Garamond" },
  { label: "Courier New", value: '"Courier New"' },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];

const LINE_HEIGHTS = [
  { label: "Single", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "Double", value: "2" },
  { label: "2.5", value: "2.5" },
  { label: "Triple", value: "3" },
];

const TEXT_COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#cccccc",
  "#ffffff",
  "#b71c1c",
  "#e53935",
  "#fb8c00",
  "#f9a825",
  "#43a047",
  "#00897b",
  "#1e88e5",
  "#3949ab",
  "#8e24aa",
  "#d81b60",
  "#6d4c41",
  "#0d47a1",
];

const HIGHLIGHT_COLORS = [
  "#fff59d",
  "#ffe082",
  "#ffccbc",
  "#f8bbd0",
  "#e1bee7",
  "#c5cae9",
  "#bbdefb",
  "#b2ebf2",
  "#c8e6c9",
  "#dcedc8",
  "#eeeeee",
  "#d7ccc8",
];

const DEFAULT_VALUE = "__default__";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
const HEADING_LEVELS: HeadingLevel[] = [1, 2, 3, 4, 5, 6];

type TextStyleKey = "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
const TEXT_STYLES: { value: TextStyleKey; label: string; className: string }[] = [
  { value: "p", label: "Normal text", className: "text-sm" },
  { value: "h1", label: "Heading 1", className: "text-xl font-bold" },
  { value: "h2", label: "Heading 2", className: "text-lg font-bold" },
  { value: "h3", label: "Heading 3", className: "text-base font-semibold" },
  { value: "h4", label: "Heading 4", className: "text-sm font-semibold" },
  { value: "h5", label: "Heading 5", className: "text-xs font-semibold" },
  {
    value: "h6",
    label: "Heading 6",
    className: "text-xs font-semibold uppercase tracking-wide",
  },
];

// Stock paragraph plus drop-cap (class) and line-height (style); styled by .blog-content in styles.css.
const Paragraph = TiptapParagraph.extend({
  addAttributes() {
    return {
      dropCap: {
        default: false,
        parseHTML: (element) => element.classList.contains("drop-cap"),
        renderHTML: (attributes) => (attributes.dropCap ? { class: "drop-cap" } : {}),
      },
      lineHeight: {
        default: null,
        parseHTML: (element) => element.style.lineHeight || null,
        renderHTML: (attributes) =>
          attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
      },
    };
  },
});

// Output must stay within RICH_TEXT_OPTIONS (backend common/sanitize.ts), or formatting is stripped on save.
const EXTENSIONS = [
  StarterKit.configure({
    paragraph: false,
    heading: { levels: HEADING_LEVELS },
    codeBlock: false,
    code: false,
    horizontalRule: false,
    link: false,
    underline: false,
  }),
  Paragraph,
  Link.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: "https",
    HTMLAttributes: { target: null, rel: "noopener noreferrer nofollow" },
  }),
  Underline,
  Subscript,
  Superscript,
  TextStyle,
  Color,
  BackgroundColor,
  FontFamily,
  FontSize,
  TextAlign.configure({ types: ["paragraph", "heading"] }),
  TableKit.configure({ table: { resizable: false } }),
];

// Browsers may hand back rgb(); swatches and <input type="color"> need #rrggbb.
function toHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return color.toLowerCase();
  return `#${m
    .slice(1, 4)
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("")}`;
}

function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return url;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return `https://${url}`;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", active && "bg-secondary text-foreground")}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

function ColorPopover({
  label,
  icon,
  current,
  swatches,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  icon: ReactNode;
  current: string | null;
  swatches: string[];
  disabled?: boolean;
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-col gap-0"
          disabled={disabled}
          aria-label={label}
          title={label}
        >
          {icon}
          <span
            className="h-1 w-4 rounded-sm border"
            style={{ background: current ?? "transparent" }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
        <div className="grid grid-cols-6 gap-1.5">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={c}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className={cn(
                "h-7 w-7 rounded border transition-transform hover:scale-110",
                current?.toLowerCase() === c && "ring-2 ring-primary ring-offset-1",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="color"
              value={current && /^#[0-9a-f]{6}$/i.test(current) ? current : "#000000"}
              onChange={(e) => onPick(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border p-0"
            />
            Custom
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            None
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TableMenu({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const inTable = editor.isActive("table");
  const run = (fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
    fn(editor.chain().focus()).run();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", inTable && "bg-secondary text-foreground")}
          disabled={disabled}
          aria-label="Table"
          title="Table"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editor.commands.focus();
        }}
      >
        <DropdownMenuItem
          disabled={inTable}
          onSelect={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
        >
          Insert table (3 × 3)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!inTable} onSelect={() => run((c) => c.addRowBefore())}>
          Add row above
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!inTable} onSelect={() => run((c) => c.addRowAfter())}>
          Add row below
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!inTable} onSelect={() => run((c) => c.addColumnBefore())}>
          Add column left
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!inTable} onSelect={() => run((c) => c.addColumnAfter())}>
          Add column right
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!inTable} onSelect={() => run((c) => c.toggleHeaderRow())}>
          Toggle header row
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!inTable} onSelect={() => run((c) => c.mergeOrSplit())}>
          Merge / split cells
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!inTable} onSelect={() => run((c) => c.deleteRow())}>
          Delete row
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!inTable} onSelect={() => run((c) => c.deleteColumn())}>
          Delete column
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!inTable}
          className="text-destructive"
          onSelect={() => run((c) => c.deleteTable())}
        >
          Delete table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkNewTab, setLinkNewTab] = useState(true);
  const [linkNeedsText, setLinkNeedsText] = useState(false);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          "blog-content min-h-60 rounded-md rounded-t-none border border-t-0 bg-background px-4 py-3 text-sm focus-visible:outline-none",
      },
    },
  });

  // v3 doesn't re-render on transactions, so toolbar state must be subscribed to explicitly.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const textStyle = e.getAttributes("textStyle");
      const paragraph = e.getAttributes("paragraph");
      const heading = HEADING_LEVELS.find((level) => e.isActive("heading", { level }));
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        subscript: e.isActive("subscript"),
        superscript: e.isActive("superscript"),
        link: e.isActive("link"),
        textStyle: (heading ? `h${heading}` : "p") as TextStyleKey,
        blockquote: e.isActive("blockquote"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        alignLeft: e.isActive({ textAlign: "left" }),
        alignCenter: e.isActive({ textAlign: "center" }),
        alignRight: e.isActive({ textAlign: "right" }),
        alignJustify: e.isActive({ textAlign: "justify" }),
        dropCap: !!paragraph.dropCap,
        lineHeight: (paragraph.lineHeight as string | null) ?? null,
        color: toHex(textStyle.color as string | null),
        backgroundColor: toHex(textStyle.backgroundColor as string | null),
        fontFamily: (textStyle.fontFamily as string | null) ?? null,
        fontSize: (textStyle.fontSize as string | null) ?? null,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  // `content` only seeds the first render; sync later async values without fighting the cursor.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor || !state) return null;

  const openLinkDialog = () => {
    const attrs = editor.getAttributes("link");
    const { from, to, empty } = editor.state.selection;
    setLinkUrl((attrs.href as string | undefined) ?? "");
    setLinkNewTab(attrs.href ? attrs.target === "_blank" : true);
    setLinkNeedsText(empty && !editor.isActive("link"));
    setLinkText(empty ? "" : editor.state.doc.textBetween(from, to, " "));
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    const href = normalizeUrl(linkUrl);
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkDialogOpen(false);
      return;
    }
    const target = linkNewTab ? "_blank" : null;
    if (linkNeedsText) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: linkText.trim() || href,
          marks: [{ type: "link", attrs: { href, target } }],
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href, target }).run();
    }
    setLinkDialogOpen(false);
  };

  // Radix returns focus to the dropdown on close; keep typing going into the document instead.
  const keepEditorFocus = (e: Event) => {
    e.preventDefault();
    editor.commands.focus();
  };

  const setTextStyle = (v: TextStyleKey) => {
    const chain = editor.chain().focus();
    if (v === "p") chain.setParagraph();
    else chain.setHeading({ level: Number(v.slice(1)) as HeadingLevel });
    chain.run();
  };

  // Works on the selection, or on the whole current block when nothing is selected.
  const clearFormatting = () => {
    const chain = editor.chain().focus();
    if (editor.state.selection.empty) chain.selectParentNode();
    chain.unsetAllMarks().unsetTextAlign();
    if (editor.isActive("heading")) chain.setParagraph();
    if (editor.isActive("blockquote")) chain.unsetBlockquote();
    chain.updateAttributes("paragraph", { dropCap: false, lineHeight: null }).run();
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkDialogOpen(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 bg-muted/40 p-1">
        <ToolbarButton
          label="Undo"
          disabled={disabled || !state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={disabled || !state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <Select
          value={state.textStyle}
          onValueChange={(v) => setTextStyle(v as TextStyleKey)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-32 text-xs" title="Text style" aria-label="Text style">
            {/* Explicit label keeps the button small; the list still previews each size. */}
            <SelectValue>{TEXT_STYLES.find((t) => t.value === state.textStyle)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={keepEditorFocus}>
            {TEXT_STYLES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <span className={t.className}>{t.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={state.fontFamily ?? DEFAULT_VALUE}
          onValueChange={(v) =>
            v === DEFAULT_VALUE
              ? editor.chain().focus().unsetFontFamily().run()
              : editor.chain().focus().setFontFamily(v).run()
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-36 text-xs" title="Font" aria-label="Font">
            <SelectValue placeholder="Font" />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={keepEditorFocus}>
            <SelectItem value={DEFAULT_VALUE}>Default font</SelectItem>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f.label} value={f.value}>
                <span style={{ fontFamily: f.value }}>{f.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={state.fontSize ?? DEFAULT_VALUE}
          onValueChange={(v) =>
            v === DEFAULT_VALUE
              ? editor.chain().focus().unsetFontSize().run()
              : editor.chain().focus().setFontSize(v).run()
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-20 text-xs" title="Font size" aria-label="Font size">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={keepEditorFocus}>
            <SelectItem value={DEFAULT_VALUE}>Auto</SelectItem>
            {FONT_SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("px", "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={state.lineHeight ?? DEFAULT_VALUE}
          onValueChange={(v) =>
            editor
              .chain()
              .focus()
              .updateAttributes("paragraph", { lineHeight: v === DEFAULT_VALUE ? null : v })
              .run()
          }
          disabled={disabled}
        >
          <SelectTrigger
            className="h-8 w-28 text-xs"
            title="Line spacing"
            aria-label="Line spacing"
          >
            <SelectValue placeholder="Spacing" />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={keepEditorFocus}>
            <SelectItem value={DEFAULT_VALUE}>Default spacing</SelectItem>
            {LINE_HEIGHTS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Divider />

        <ToolbarButton
          label="Bold"
          active={state.bold}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={state.italic}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={state.underline}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={state.strike}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Subscript"
          active={state.subscript}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        >
          <SubscriptIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Superscript"
          active={state.superscript}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          <SuperscriptIcon className="h-4 w-4" />
        </ToolbarButton>

        <ColorPopover
          label="Text color"
          icon={<Baseline className="h-3.5 w-3.5" />}
          current={state.color}
          swatches={TEXT_COLORS}
          disabled={disabled}
          onPick={(c) => editor.chain().focus().setColor(c).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />
        <ColorPopover
          label="Highlight"
          icon={<Highlighter className="h-3.5 w-3.5" />}
          current={state.backgroundColor}
          swatches={HIGHLIGHT_COLORS}
          disabled={disabled}
          onPick={(c) => editor.chain().focus().setBackgroundColor(c).run()}
          onClear={() => editor.chain().focus().unsetBackgroundColor().run()}
        />

        <Divider />

        <ToolbarButton
          label="Link"
          active={state.link}
          disabled={disabled}
          onClick={openLinkDialog}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Remove link"
          disabled={disabled || !state.link}
          onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={state.blockquote}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <TextQuote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={state.bulletList}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={state.orderedList}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <TableMenu editor={editor} disabled={disabled} />

        <Divider />

        <ToolbarButton
          label="Align left"
          active={state.alignLeft}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={state.alignCenter}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={state.alignRight}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Justify"
          active={state.alignJustify}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          label="Drop cap"
          active={state.dropCap}
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().updateAttributes("paragraph", { dropCap: !state.dropCap }).run()
          }
        >
          <span className="font-serif text-base font-bold leading-none">A</span>
        </ToolbarButton>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          disabled={disabled}
          onClick={clearFormatting}
          title="Clear formatting"
        >
          <RemoveFormatting className="h-4 w-4" /> Clear formatting
        </Button>
      </div>
      <EditorContent editor={editor} />

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={keepEditorFocus}>
          <DialogHeader>
            <DialogTitle>{state.link ? "Edit link" : "Insert link"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3 py-1"
            onSubmit={(e) => {
              // Stop the submit reaching a form that wraps the editor (React bubbles through portals).
              e.preventDefault();
              e.stopPropagation();
              applyLink();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="blog-link-url">URL</Label>
              <Input
                id="blog-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
              />
            </div>
            {linkNeedsText && (
              <div className="space-y-1.5">
                <Label htmlFor="blog-link-text">Text to display</Label>
                <Input
                  id="blog-link-text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Defaults to the URL"
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={linkNewTab} onCheckedChange={(v) => setLinkNewTab(v === true)} />
              Open in a new tab
            </label>
            <DialogFooter className="gap-2 sm:justify-between">
              {state.link ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={removeLink}
                >
                  Remove link
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{state.link ? "Update link" : "Insert link"}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
