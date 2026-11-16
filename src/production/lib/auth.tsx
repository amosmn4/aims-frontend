import { useAccount } from "@/lib/account";
import { useWorkspace } from "@/lib/workspace";
import { useModuleAccess } from "@/lib/modules";

export function useAuth() {
  const { account, ready } = useAccount();
  const { people } = useWorkspace();
  const water = useModuleAccess("water");
  const blog = useModuleAccess("blog");
  const person = people.find((row) => row.id === account?.personId);
  return {
    loading: !ready,
    viewAs: null,
    isAdminOrCeo: false,
    profile: account ? { fullName: person?.name ?? "", email: account.email } : null,
    hasRole: (role: string | string[]) =>
      (Array.isArray(role) ? role : [role]).includes("water") && water === "manage",
    hasCapability: (capability: string) => capability === "publish_blog" && blog === "manage",
  };
}
