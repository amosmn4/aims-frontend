# Routes

This app uses TanStack Router file-based routing with Vite.

| File                 | URL                                     |
| -------------------- | --------------------------------------- |
| `index.tsx`          | `/`                                     |
| `login.tsx`          | `/login`                                |
| `projects.index.tsx` | `/projects`                             |
| `projects.$id.tsx`   | `/projects/:id`                         |
| `__root.tsx`         | Root providers, account gate and outlet |

Keep route files in this directory. Keep shared components and storage code outside it. The Vite router plugin generates `src/routeTree.gen.ts`; do not edit it manually.

The root account gate handles unauthenticated routes and return destinations. The app shell uses shared visibility rules for restricted modules. These are local demo UI checks; the future backend must independently authenticate and authorize requests.
