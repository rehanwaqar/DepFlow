import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../api';

const STATUS_COLOR = {
  todo: '#94a3b8',
  in_progress: '#2563eb',
  blocked: '#b45309',
  done: '#0d7c66',
};

function layoutNodes(nodes, edges) {
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  const outs = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
    outs.get(e.source)?.push(e.target);
  }

  const layers = new Map();
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
  queue.forEach((id) => layers.set(id, 0));
  const seen = new Set(queue);

  while (queue.length) {
    const id = queue.shift();
    const layer = layers.get(id) || 0;
    for (const t of outs.get(id) || []) {
      layers.set(t, Math.max(layers.get(t) || 0, layer + 1));
      if (!seen.has(t)) {
        seen.add(t);
        queue.push(t);
      }
    }
  }

  const byLayer = new Map();
  for (const n of nodes) {
    const L = layers.get(n.id) ?? 0;
    if (!byLayer.has(L)) byLayer.set(L, []);
    byLayer.get(L).push(n);
  }

  const positioned = [];
  for (const [L, list] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    list.forEach((n, i) => {
      positioned.push({
        id: n.id,
        position: { x: L * 260, y: i * 110 },
        data: {
          label: n.title,
          status: n.status,
          isBottleneck: n.isBottleneck,
        },
        style: {
          border: n.isBottleneck ? '2px solid #b45309' : `1px solid ${STATUS_COLOR[n.status]}`,
          background: n.isBottleneck ? '#fff7ed' : '#ffffff',
          borderRadius: 10,
          padding: 10,
          width: 180,
          fontSize: 13,
          fontFamily: 'Manrope, system-ui, sans-serif',
          boxShadow: n.isBottleneck ? '0 0 0 3px rgba(180, 83, 9, 0.12)' : '0 1px 2px rgba(20,32,51,0.06)',
        },
      });
    });
  }
  return positioned;
}

export default function DependencyFlow({ projectId, onOpenTask }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api(`/projects/${projectId}/flow`);
        if (cancelled) return;
        const laid = layoutNodes(data.nodes, data.edges);
        setNodes(
          laid.map((n) => ({
            ...n,
            data: {
              ...n.data,
              label: (
                <div className="flow-node-label">
                  <strong>{n.data.label}</strong>
                  <span>{n.data.status.replace('_', ' ')}</span>
                  {n.data.isBottleneck && <em>bottleneck</em>}
                </div>
              ),
            },
          }))
        );
        setEdges(
          data.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { stroke: '#8aa0b5' },
          }))
        );
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, setNodes, setEdges]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  if (loading) return <div className="flow-wrap muted">Loading dependency flow…</div>;
  if (error) return <div className="alert">{error}</div>;

  return (
    <div className="flow-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        proOptions={proOptions}
        onNodeClick={(_e, node) => onOpenTask?.(node.id)}
      >
        <Background gap={18} color="#d5dee8" />
        <Controls />
        <MiniMap
          nodeColor={(n) => (n.data?.isBottleneck ? '#b45309' : STATUS_COLOR[n.data?.status] || '#999')}
        />
      </ReactFlow>
    </div>
  );
}
