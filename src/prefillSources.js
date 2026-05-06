export const GLOBAL_FIELDS = [
  { id: "global.current_user.name", label: "Current user name", type: "string" },
  { id: "global.current_user.email", label: "Current user email", type: "email" },
  { id: "global.current_user.id", label: "Current user ID", type: "string" },
  { id: "global.organization.name", label: "Organization name", type: "string" },
  { id: "global.today", label: "Today", type: "date" },
];

export function fieldKeyFromScope(scope) {
  return scope?.replace("#/properties/", "");
}

export function fieldLabel(form, key) {
  const uiElement = form?.ui_schema?.elements?.find((element) => fieldKeyFromScope(element.scope) === key);
  return uiElement?.label || form?.field_schema?.properties?.[key]?.title || key;
}

export function getFormFields(form) {
  if (!form?.field_schema?.properties) return [];
  const uiOrder = form.ui_schema?.elements?.map((element) => fieldKeyFromScope(element.scope)).filter(Boolean) || [];
  const schemaKeys = Object.keys(form.field_schema.properties);
  const orderedKeys = [...uiOrder, ...schemaKeys.filter((key) => !uiOrder.includes(key))];

  return orderedKeys.map((key) => {
    const schema = form.field_schema.properties[key];
    return {
      key,
      label: fieldLabel(form, key),
      type: schema?.format || schema?.avantos_type || schema?.type || "value",
      required: form.field_schema.required?.includes(key) || false,
    };
  });
}

export function buildGraphIndex(graph) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const formsById = new Map(graph.forms.map((form) => [form.id, form]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, []]));

  graph.edges.forEach((edge) => {
    incoming.get(edge.target)?.push(edge.source);
  });

  return { nodesById, formsById, incoming };
}

export function collectAncestors(nodeId, incoming) {
  const direct = incoming.get(nodeId) || [];
  const visited = new Set(direct);
  const ordered = [];

  function visit(id) {
    const parents = incoming.get(id) || [];
    parents.forEach((parentId) => {
      if (visited.has(parentId)) return;
      visited.add(parentId);
      ordered.push(parentId);
      visit(parentId);
    });
  }

  direct.forEach(visit);

  return {
    direct,
    transitive: ordered,
  };
}

function formFieldSourceGroup(title, nodeIds, graphIndex) {
  return {
    title,
    items: nodeIds.flatMap((nodeId) => {
      const node = graphIndex.nodesById.get(nodeId);
      const form = graphIndex.formsById.get(node?.data?.component_id);
      return getFormFields(form).map((field) => ({
        id: `form.${nodeId}.${field.key}`,
        label: `${node?.data?.name || nodeId} / ${field.label}`,
        sourceLabel: node?.data?.name || nodeId,
        detail: field.type,
        sourceType: title,
        path: field.key,
      }));
    }),
  };
}

function globalSourceGroup() {
  return {
    title: "Global Data",
    items: GLOBAL_FIELDS.map((field) => ({
      id: field.id,
      label: field.label,
      sourceLabel: "Global Data",
      detail: field.type,
      sourceType: "Global Data",
      path: field.id.replace("global.", ""),
    })),
  };
}

export const sourceProviders = [
  {
    id: "global",
    getGroup: globalSourceGroup,
  },
  {
    id: "directDependencies",
    getGroup: ({ selectedNode, graphIndex }) => {
      const { direct } = collectAncestors(selectedNode.id, graphIndex.incoming);
      return formFieldSourceGroup("Direct Dependencies", direct, graphIndex);
    },
  },
  {
    id: "transitiveDependencies",
    getGroup: ({ selectedNode, graphIndex }) => {
      const { transitive } = collectAncestors(selectedNode.id, graphIndex.incoming);
      return formFieldSourceGroup("Transitive Dependencies", transitive, graphIndex);
    },
  },
];

export function buildSourceGroups(selectedNode, graphIndex, providers = sourceProviders) {
  if (!selectedNode || !graphIndex) return [];

  return providers
    .map((provider) => provider.getGroup({ selectedNode, graphIndex }))
    .filter((group) => group.items.length > 0);
}

export function sortNodes(nodes) {
  return [...nodes].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
}
