# Journey Builder React Coding Challenge

This repo contains the provided challenge API server plus a React Journey Builder client for configuring prefill mappings across a journey graph.

## Requirements

- Node.js 20 or newer
- npm

## Running locally

Install dependencies:

```bash
npm install
```

Start the API server:

```bash
npm start
```

In a second terminal, start the React app:

```bash
npm run dev
```

Open http://127.0.0.1:5173.

## What is implemented

- Fetches the action blueprint graph from `/api/v1/1/actions/blueprints/bp_01jk766tckfwx84xjcxazggzyc/graph`.
- Renders the journey graph using the provided node positions and edges.
- Lets a user select a form and configure prefill mappings for every field.
- Supports global data, direct dependency fields, and transitive dependency fields as mapping sources.
- Persists mappings in local storage while reviewing the journey.

## Implementation notes

- The API server remains a small Node HTTP server serving the supplied `graph.json`.
- The React client is built with Vite and plain React state.
- Source options are derived from the graph edges, so adding more nodes or dependencies to `graph.json` updates the mapping choices automatically.
- Mappings are stored by selected form node ID and destination field key.
- Data source behavior is isolated in `src/prefillSources.js`.

## Extending data sources

`src/prefillSources.js` exports a `sourceProviders` array. Each provider implements:

```js
{
  id: "providerName",
  getGroup: ({ selectedNode, graphIndex }) => ({
    title: "Provider Label",
    items: [
      {
        id: "stable.source.id",
        label: "Display label",
        sourceLabel: "Provider Label",
        detail: "string",
        sourceType: "Provider Label",
        path: "source.path"
      }
    ]
  })
}
```

Add a provider to that array to expose another source type in the picker. Existing providers cover global data, direct form dependencies, and transitive form dependencies.

## Validation

```bash
npm test
npm run build
```
