
  # Design data dashboard

  This is a code bundle for Design data dashboard. The original project is available at https://www.figma.com/design/tnYyN39Y64D3vjtNQ7cMBD/Design-data-dashboard.

  ## To install shadcn components
  Make sure the package is already installed by running `npm install` or `npm i` to install it and related dependencies.

Run this command:
```bash 
npx shadcn@latest init
``` 
which will initialize `components.json` and the `lib/utils.js` file used for class merging. 

These following options will be default:
  1) Select `Radix` as the `component library`
  2) Select `Nova` as the `preset`
  3) If all goes well, it will install `shadcn`and its dependencies successfully

For components in `InventoryInsights.tsx` specifically, run this command 
```bash 
npx shadcn@latest add card button select popover
```

  ### Notes
  - **Path Aliases:** Ensure your `tsconfig.json` or `jsconfig.json` includes the `@/` path alias before running the shadcn init command, otherwise, the CLI will fail to resolve the component directory.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  