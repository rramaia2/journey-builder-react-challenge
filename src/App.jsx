import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  CircleDot,
  Database,
  GitBranch,
  Link2,
  Loader2,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  buildGraphIndex,
  buildSourceGroups,
  getFormFields,
  sortNodes,
} from "./prefillSources.js";

const BLUEPRINT_ID = "bp_01jk766tckfwx84xjcxazggzyc";
const TENANT_ID = "1";
const GRAPH_ENDPOINT = `/api/v1/${TENANT_ID}/actions/blueprints/${BLUEPRINT_ID}/graph`;
const STORAGE_KEY = "journey-builder-prefill-mappings";

function loadMappings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function App() {
  const [graph, setGraph] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [mappings, setMappings] = useState(loadMappings);
  const [modalField, setModalField] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetch(GRAPH_ENDPOINT)
      .then((response) => {
        if (!response.ok) throw new Error(`Graph request failed with ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setGraph(data);
        setSelectedNodeId(data.nodes?.[0]?.id || null);
      })
      .catch((fetchError) => {
        if (isMounted) setError(fetchError.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  }, [mappings]);

  const graphIndex = useMemo(() => (graph ? buildGraphIndex(graph) : null), [graph]);
  const selectedNode = selectedNodeId && graphIndex ? graphIndex.nodesById.get(selectedNodeId) : null;
  const selectedForm = selectedNode ? graphIndex.formsById.get(selectedNode.data.component_id) : null;
  const selectedFields = useMemo(() => getFormFields(selectedForm), [selectedForm]);
  const sourceGroups = useMemo(() => buildSourceGroups(selectedNode, graphIndex || { incoming: new Map() }), [selectedNode, graphIndex]);
  const selectedMappings = mappings[selectedNodeId] || {};

  function setFieldMapping(fieldKey, source) {
    setMappings((current) => ({
      ...current,
      [selectedNodeId]: {
        ...(current[selectedNodeId] || {}),
        [fieldKey]: source,
      },
    }));
    setModalField(null);
    setQuery("");
  }

  function clearFieldMapping(fieldKey) {
    setMappings((current) => {
      const nextNodeMappings = { ...(current[selectedNodeId] || {}) };
      delete nextNodeMappings[fieldKey];
      return { ...current, [selectedNodeId]: nextNodeMappings };
    });
  }

  if (error) {
    return (
      <main className="center-screen">
        <section className="error-panel">
          <h1>Journey Builder</h1>
          <p>{error}</p>
          <span>Start the API server with npm start, then run the React app with npm run dev.</span>
        </section>
      </main>
    );
  }

  if (!graph) {
    return (
      <main className="center-screen">
        <Loader2 className="spin" size={28} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Journey Builder</p>
          <h1>{graph.name}</h1>
        </div>
        <div className="summary">
          <span><GitBranch size={16} /> {graph.nodes.length} forms</span>
          <span><Link2 size={16} /> {graph.edges.length} links</span>
        </div>
      </header>

      <section className="workspace">
        <JourneyCanvas
          graph={graph}
          selectedNodeId={selectedNodeId}
          mappings={mappings}
          onSelect={setSelectedNodeId}
        />

        <aside className="inspector">
          <div className="inspector-header">
            <div>
              <p className="eyebrow">Selected Form</p>
              <h2>{selectedNode?.data?.name}</h2>
            </div>
            <CircleDot size={22} />
          </div>

          <div className="metadata-grid">
            <span>ID</span>
            <strong>{selectedNode?.data?.id}</strong>
            <span>Prerequisites</span>
            <strong>{selectedNode?.data?.prerequisites?.length || 0}</strong>
          </div>

          <div className="section-title">
            <Settings2 size={18} />
            <h3>Prefill Mappings</h3>
          </div>

          <div className="field-list">
            {selectedFields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                mapping={selectedMappings[field.key]}
                onChoose={() => setModalField(field)}
                onClear={() => clearFieldMapping(field.key)}
              />
            ))}
          </div>
        </aside>
      </section>

      {modalField && (
        <SourceModal
          field={modalField}
          groups={sourceGroups}
          query={query}
          onQuery={setQuery}
          onSelect={(source) => setFieldMapping(modalField.key, source)}
          onClose={() => {
            setModalField(null);
            setQuery("");
          }}
        />
      )}
    </main>
  );
}

function JourneyCanvas({ graph, selectedNodeId, mappings, onSelect }) {
  const nodes = sortNodes(graph.nodes);
  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.position.x),
      minY: Math.min(acc.minY, node.position.y),
      maxX: Math.max(acc.maxX, node.position.x),
      maxY: Math.max(acc.maxY, node.position.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  const width = Math.max(900, bounds.maxX - bounds.minX + 360);
  const height = Math.max(440, bounds.maxY - bounds.minY + 240);
  const nodePositions = new Map(
    graph.nodes.map((node) => [
      node.id,
      {
        x: node.position.x - bounds.minX + 90,
        y: node.position.y - bounds.minY + 80,
      },
    ]),
  );

  return (
    <section className="canvas-wrap" aria-label="Journey graph">
      <div className="canvas" style={{ minWidth: width, minHeight: height }}>
        <svg className="edge-layer" width={width} height={height}>
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const source = nodePositions.get(edge.source);
            const target = nodePositions.get(edge.target);
            if (!source || !target) return null;
            const x1 = source.x + 190;
            const y1 = source.y + 42;
            const x2 = target.x;
            const y2 = target.y + 42;
            const mid = x1 + Math.max(60, (x2 - x1) / 2);
            return (
              <path
                key={`${edge.source}-${edge.target}`}
                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2 - 12} ${y2}`}
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                markerEnd="url(#arrow)"
              />
            );
          })}
        </svg>
        {nodes.map((node) => {
          const position = nodePositions.get(node.id);
          const mappingCount = Object.keys(mappings[node.id] || {}).length;
          return (
            <button
              className={`journey-node ${node.id === selectedNodeId ? "selected" : ""}`}
              key={node.id}
              style={{ left: position.x, top: position.y }}
              onClick={() => onSelect(node.id)}
            >
              <span className="node-title">{node.data.name}</span>
              <span className="node-meta">
                <ArrowDownToLine size={14} />
                {mappingCount} mapped
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FieldRow({ field, mapping, onChoose, onClear }) {
  return (
    <div className="field-row">
      <div>
        <div className="field-name">
          {field.label}
          {field.required && <span>Required</span>}
        </div>
        <p>{mapping ? `${mapping.sourceLabel} / ${mapping.path}` : field.type}</p>
      </div>
      <div className="field-actions">
        {mapping && (
          <button className="icon-button" onClick={onClear} aria-label={`Clear ${field.label} mapping`} title="Clear mapping">
            <Trash2 size={16} />
          </button>
        )}
        <button className="map-button" onClick={onChoose}>
          {mapping ? "Change" : "Set"}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function SourceModal({ field, groups, query, onQuery, onSelect, onClose }) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="source-modal-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Choose Source</p>
            <h2 id="source-modal-title">{field.label}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close source picker">
            <X size={18} />
          </button>
        </div>

        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search fields" autoFocus />
        </label>

        <div className="source-groups">
          {filteredGroups.length === 0 && <p className="empty-state">No matching sources.</p>}
          {filteredGroups.map((group) => (
            <section className="source-group" key={group.title}>
              <h3><Database size={16} /> {group.title}</h3>
              {group.items.map((item) => (
                <button key={item.id} className="source-option" onClick={() => onSelect(item)}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <Check size={16} />
                </button>
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
