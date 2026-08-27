import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapParagraph from "@tiptap/extension-paragraph";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
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
  Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// Same web-safe list the backend's sanitizeContent() allowlist (blog.service.ts,
// BLOG_FONT_FAMILIES) pins to exactly — deliberately a curated <Select>, not free text, so that
// allowlist can be an exact match instead of trying to validate arbitrary font-family strings.
// Multi-word names are pre-quoted here so the value Tiptap writes into `style` is valid CSS.
const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: '"Times New Roman"' },
  { label: "Courier New", value: '"Courier New"' },
  { label: "Verdana", value: "Verdana" },
];

// Adds a `dropCap` boolean attribute to the stock paragraph node, rendered as `class="drop-cap"`
// — styled in styles.css (.drop-cap::first-letter), shared by the live editor and the standalone
// preview page so the effect looks identical in both. No official Tiptap extension for this.
const Paragraph = TiptapParagraph.extend({
  addAttributes() {
    return {
      dropCap: {
        default: false,
        parseHTML: (element) => element.classList.contains("drop-cap"),
        renderHTML: (attributes) => (attributes.dropCap ? { class: "drop-cap" } : {}),
      },
    };
  },
});

// Body-content formatting only — no headings/blockquote/code/tables. Images already have their
// own dedicated upload field elsewhere on the post, and this stays "format the text," not "lay
// out the page." The allowed tag/attribute set here must stay in lockstep with the backend's
// sanitizeContent() allowlist (blog.service.ts) — that's the actual security boundary since
// content is served to the public website; this just keeps what the editor can produce from
// silently disappearing after save.
const EXTENSIONS = [
  StarterKit.configure({
    paragraph: false, // replaced by the drop-cap-aware Paragraph above
    heading: false,
    blockquote: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
  }),
  Paragraph,
  Link.configure({ openOnClick: false, autolink: true }),
  Underline,
  Subscript,
  Superscript,
  TextStyle,
  Color,
  FontFamily,
  TextAlign.configure({ types: ["paragraph"] }),
];

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
  children: React.ReactNode;
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
      title={label}
    >
      {children}
    </Button>
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

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-40 rounded-md border border-t-0 rounded-t-none bg-background px-3 py-2 text-sm focus-visible:outline-none prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
      },
    },
  });

  // `content` passed to useEditor only seeds the INITIAL document — it doesn't stay reactive.
  // The parent's `value` (post.content) typically arrives asynchronously after the editor is
  // already mounted (data still loading on first render), so without this the editor would sit
  // permanently empty. Only calls setContent when the value genuinely differs from what the
  // editor itself just produced, so a normal keystroke's own onChange round-trip never fights
  // the user's cursor position.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const openLinkDialog = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previous ?? "");
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    }
    setLinkDialogOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setLinkDialogOpen(false);
  };

  const dropCapActive = !!editor.getAttributes("paragraph").dropCap;
  const toggleDropCap = () => {
    editor.chain().focus().updateAttributes("paragraph", { dropCap: !dropCapActive }).run();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 bg-muted/40 p-1">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Subscript"
          active={editor.isActive("subscript")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        >
          <SubscriptIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Superscript"
          active={editor.isActive("superscript")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          <SuperscriptIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          disabled={disabled}
          onClick={openLinkDialog}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          label="Align left"
          active={editor.isActive({ textAlign: "left" })}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={editor.isActive({ textAlign: "center" })}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={editor.isActive({ textAlign: "right" })}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Justify"
          active={editor.isActive({ textAlign: "justify" })}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          label="Drop cap"
          active={dropCapActive}
          disabled={disabled}
          onClick={toggleDropCap}
        >
          <span className="font-serif text-sm font-bold">A</span>
        </ToolbarButton>

        <div className="relative">
          <ToolbarButton label="Text color" disabled={disabled} onClick={() => {}}>
            <Baseline
              className="h-4 w-4"
              style={{ color: (editor.getAttributes("textStyle").color as string) || undefined }}
            />
          </ToolbarButton>
          <input
            type="color"
            aria-label="Text color"
            disabled={disabled}
            value={(editor.getAttributes("textStyle").color as string) || "#000000"}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="absolute inset-0 h-8 w-8 cursor-pointer opacity-0"
          />
        </div>
        <ToolbarButton
          label="Clear text color"
          disabled={disabled}
          onClick={() => editor.chain().focus().unsetColor().run()}
        >
          <Eraser className="h-4 w-4" />
        </ToolbarButton>

        <Select
          value={(editor.getAttributes("textStyle").fontFamily as string) || "__default__"}
          onValueChange={(v) => {
            if (v === "__default__") {
              editor.chain().focus().unsetFontFamily().run();
            } else {
              editor.chain().focus().setFontFamily(v).run();
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Font" />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f.label} value={f.value || "__default__"}>
                <span style={{ fontFamily: f.value || undefined }}>{f.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <EditorContent editor={editor} />

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>URL</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editor.isActive("link") && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={removeLink}
              >
                Remove link
              </Button>
            )}
            <Button type="button" onClick={applyLink}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
