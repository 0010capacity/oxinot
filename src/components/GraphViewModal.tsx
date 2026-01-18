import {
  Modal,
  Stack,
  Group,
  Center,
  Loader,
  Text,
  ActionIcon,
  Tooltip,
  SegmentedControl,
} from "@mantine/core";
import { IconLink, IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as d3 from "d3";
import styles from "./GraphViewModal.module.css";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  node_type: string;
  page_id: string;
  block_id?: string;
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  relation_type: string;
  is_embed: boolean;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphViewModalProps {
  opened: boolean;
  onClose: () => void;
  workspacePath: string;
  currentPageId?: string;
}

export function GraphViewModal({
  opened,
  onClose,
  workspacePath,
  currentPageId,
}: GraphViewModalProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"full" | "page">("full");
  const [depth, setDepth] = useState<string>("2");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchGraphData = useCallback(async () => {
    if (!workspacePath) return;

    setLoading(true);
    try {
      let data: GraphData;

      if (viewMode === "page" && currentPageId) {
        const rawData = await invoke<{
          nodes: Array<{
            id: string;
            label: string;
            node_type: string;
            page_id: string;
            block_id?: string;
          }>;
          edges: Array<{
            source: string;
            target: string;
            relation_type: string;
            is_embed: boolean;
          }>;
        }>("get_page_graph_data", {
          workspacePath,
          pageId: currentPageId,
          depth: Number.parseInt(depth),
        });
        data = {
          nodes: rawData.nodes,
          edges: rawData.edges.map((e) => ({
            ...e,
            source: e.source,
            target: e.target,
          })),
        };
      } else {
        const rawData = await invoke<{
          nodes: Array<{
            id: string;
            label: string;
            node_type: string;
            page_id: string;
            block_id?: string;
          }>;
          edges: Array<{
            source: string;
            target: string;
            relation_type: string;
            is_embed: boolean;
          }>;
        }>("get_graph_data", {
          workspacePath,
        });
        data = {
          nodes: rawData.nodes,
          edges: rawData.edges.map((e) => ({
            ...e,
            source: e.source,
            target: e.target,
          })),
        };
      }

      setGraphData(data);
    } catch (error) {
      console.error("Failed to fetch graph data:", error);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, viewMode, depth, currentPageId]);

  useEffect(() => {
    if (opened) {
      fetchGraphData();
    }
  }, [opened, fetchGraphData]);

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create simulation
    const simulation = d3
      .forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(
            graphData.edges as d3.SimulationLinkDatum<GraphNode>[]
          )
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength(-300))
      .force("center", d3.forceCenter<GraphNode>(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius(40));

    // Create arrow markers
    svg
      .append("defs")
      .selectAll("marker")
      .data(["embed", "link"])
      .enter()
      .append("marker")
      .attr("id", (d) => `arrow-${d}`)
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("refX", 25)
      .attr("refY", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", (d) =>
        d === "embed"
          ? "var(--color-text-secondary)"
          : "var(--color-text-tertiary)"
      );

    // Create links
    const links = svg
      .selectAll("line")
      .data(graphData.edges)
      .enter()
      .append("line")
      .attr("class", (d) => (d.is_embed ? styles.linkEmbed : styles.link))
      .attr("stroke", (d) =>
        d.is_embed
          ? "var(--color-text-secondary)"
          : "var(--color-text-tertiary)"
      )
      .attr("stroke-width", (d) => (d.is_embed ? 2 : 1))
      .attr("marker-end", (d) => `url(#arrow-${d.is_embed ? "embed" : "link"})`)
      .attr("opacity", 0.6);

    // Create nodes
    const nodes = svg
      .selectAll("circle")
      .data(graphData.nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => (d.node_type === "page" ? 8 : 5))
      .attr("fill", (d) =>
        d.node_type === "page"
          ? "var(--color-interactive-hover)"
          : "var(--color-text-secondary)"
      )
      .attr("opacity", 0.8)
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on(
            "start",
            (
              event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>,
              d
            ) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            }
          )
          .on(
            "drag",
            (
              event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>,
              d
            ) => {
              d.fx = event.x;
              d.fy = event.y;
            }
          )
          .on(
            "end",
            (
              event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>,
              d
            ) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = undefined;
              d.fy = undefined;
            }
          )
      );

    // Create labels
    const labels = svg
      .selectAll("text")
      .data(graphData.nodes)
      .enter()
      .append("text")
      .attr("font-size", "11px")
      .attr("fill", "var(--color-text-primary)")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .text((d) => d.label)
      .attr("pointer-events", "none");

    // Add tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("padding", "4px 8px")
      .style("background", "var(--color-bg-secondary)")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("visibility", "hidden");

    nodes
      .on("mouseover", (_event: MouseEvent, d: GraphNode) => {
        tooltip
          .style("visibility", "visible")
          .text(d.label)
          .style("left", `${_event.pageX + 10}px`)
          .style("top", `${_event.pageY + 10}px`);
      })
      .on("mousemove", (event: MouseEvent) => {
        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`);
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden");
      });

    simulation.on("tick", () => {
      links
        .attr("x1", (d) => {
          const source = d.source as GraphNode;
          return source.x || 0;
        })
        .attr("y1", (d) => {
          const source = d.source as GraphNode;
          return source.y || 0;
        })
        .attr("x2", (d) => {
          const target = d.target as GraphNode;
          return target.x || 0;
        })
        .attr("y2", (d) => {
          const target = d.target as GraphNode;
          return target.y || 0;
        });

      nodes.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0);

      labels.attr("x", (d) => d.x || 0).attr("y", (d) => d.y || 0);
    });

    return () => {
      tooltip.remove();
      simulation.stop();
    };
  }, [graphData]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconLink size={20} />
          <Text fw={600}>Graph</Text>
        </Group>
      }
      size="90%"
      styles={{
        header: {
          borderBottom: "1px solid var(--color-border)",
        },
        body: {
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          height: "85vh",
        },
      }}
    >
      <Stack gap="sm" h="100%" style={{ flex: 1 }}>
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <SegmentedControl
              value={viewMode}
              onChange={(val) =>
                setViewMode((val as "full" | "page") || "full")
              }
              data={[
                { label: "Full", value: "full" },
                {
                  label: "Current",
                  value: "page",
                  disabled: !currentPageId,
                },
              ]}
              size="xs"
            />

            {viewMode === "page" && (
              <SegmentedControl
                value={depth}
                onChange={(val) => setDepth(val || "2")}
                data={[
                  { label: "1", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                ]}
                size="xs"
              />
            )}
          </Group>

          <Tooltip label="Refresh graph" position="left">
            <ActionIcon
              onClick={fetchGraphData}
              variant="subtle"
              size="sm"
              disabled={loading}
              loading={loading}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <div
          ref={containerRef}
          className={styles.container}
          style={{
            flex: 1,
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            overflow: "hidden",
            position: "relative",
            minHeight: 0,
          }}
        >
          {loading ? (
            <Center h="100%">
              <Loader size="lg" />
            </Center>
          ) : graphData && graphData.nodes.length > 0 ? (
            <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Center h="100%">
              <Text c="dimmed" size="sm">
                No graph data available
              </Text>
            </Center>
          )}
        </div>
      </Stack>
    </Modal>
  );
}
