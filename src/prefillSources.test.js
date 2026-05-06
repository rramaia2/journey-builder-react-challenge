import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGraphIndex,
  buildSourceGroups,
  collectAncestors,
  getFormFields,
} from "./prefillSources.js";

function form(id, keys) {
  return {
    id,
    field_schema: {
      type: "object",
      properties: Object.fromEntries(keys.map((key) => [key, { title: key.toUpperCase(), type: "string" }])),
      required: [keys[0]],
    },
    ui_schema: {
      elements: keys.map((key) => ({
        type: "Control",
        scope: `#/properties/${key}`,
        label: `${key} label`,
      })),
    },
  };
}

const graph = {
  nodes: [
    { id: "form-a", position: { x: 0, y: 0 }, data: { name: "Form A", component_id: "schema-a" } },
    { id: "form-b", position: { x: 1, y: 0 }, data: { name: "Form B", component_id: "schema-b" } },
    { id: "form-d", position: { x: 2, y: 0 }, data: { name: "Form D", component_id: "schema-d" } },
  ],
  edges: [
    { source: "form-a", target: "form-b" },
    { source: "form-b", target: "form-d" },
  ],
  forms: [
    form("schema-a", ["accountId", "accountName"]),
    form("schema-b", ["email"]),
    form("schema-d", ["notes"]),
  ],
};

test("collectAncestors separates direct and transitive dependencies", () => {
  const graphIndex = buildGraphIndex(graph);

  assert.deepEqual(collectAncestors("form-d", graphIndex.incoming), {
    direct: ["form-b"],
    transitive: ["form-a"],
  });
});

test("buildSourceGroups returns global, direct dependency, and transitive dependency groups", () => {
  const graphIndex = buildGraphIndex(graph);
  const groups = buildSourceGroups(graphIndex.nodesById.get("form-d"), graphIndex);

  assert.deepEqual(groups.map((group) => group.title), [
    "Global Data",
    "Direct Dependencies",
    "Transitive Dependencies",
  ]);
  assert.equal(groups[1].items[0].label, "Form B / email label");
  assert.equal(groups[2].items[0].label, "Form A / accountId label");
});

test("buildSourceGroups accepts future source providers without core code changes", () => {
  const graphIndex = buildGraphIndex(graph);
  const customProviders = [
    {
      id: "externalSystem",
      getGroup: () => ({
        title: "External System",
        items: [{ id: "external.customer.id", label: "Customer ID" }],
      }),
    },
  ];

  const groups = buildSourceGroups(graphIndex.nodesById.get("form-d"), graphIndex, customProviders);

  assert.deepEqual(groups, [
    {
      title: "External System",
      items: [{ id: "external.customer.id", label: "Customer ID" }],
    },
  ]);
});

test("getFormFields respects UI schema labels and required fields", () => {
  assert.deepEqual(getFormFields(form("schema", ["id", "name"])), [
    { key: "id", label: "id label", type: "string", required: true },
    { key: "name", label: "name label", type: "string", required: false },
  ]);
});
