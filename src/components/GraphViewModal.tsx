import {
  Modal,
  Group,
  Center,
  Loader,
  Text,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  Slider,
  Box,
  Divider,
  Stack,
} from "@mantine/core";
import { IconLink, IconRefresh, IconZoomReset } from "@tabler/icons-react";
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

  // Physics simulation parameters
  const [chargeStrength, setChargeStrength] = useState(-300);
  const [linkDistance, setLinkDistance] = useState(100);
  const [collisionRadius, setCollisionRadius] = useState(40);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(
    null,
  );
  const tooltipRef = useRef<d3.Selection<
    HTMLDivElement,
    unknown,
    HTMLElement,
    unknown
  > | null>(null);

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

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg
      .transition()
      .duration(750)
      .call(
        (d3.zoom<SVGSVGElement, unknown>() as any).transform as any,
        d3.zoomIdentity,
      );
  }, []);

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

    // Create a group for zoomable content
    const g = svg.append("g");

    // Create simulation with current physics parameters
    const simulation = d3
      .forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(
            graphData.edges as d3.SimulationLinkDatum<GraphNode>[],
          )
          .id((d) => d.id)
          .distance(linkDistance),
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength(chargeStrength))
      .force(
        "center",
        d3.forceCenter<GraphNode>(width / 2, height / 2).strength(0.1),
      )
      .force("collision", d3.forceCollide<GraphNode>().radius(collisionRadius));

    simulationRef.current = simulation;

    // Create links
    const links = g
      .selectAll("line")
      .data(graphData.edges)
      .enter()
      .append("line")
      .attr("class", (d) => (d.is_embed ? styles.linkEmbed : styles.link))
      .attr("stroke", (d) =>
        d.is_embed
          ? "var(--color-text-secondary)"
          : "var(--color-text-tertiary)",
      )
      .attr("stroke-width", (d) => (d.is_embed ? 2 : 1))
      .attr("opacity", 0.6);

    // Create nodes
    const nodes = g
      .selectAll("circle")
      .data(graphData.nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => (d.node_type === "page" ? 8 : 5))
      .attr("fill", (d) =>
        d.node_type === "page"
          ? "var(--color-interactive-hover)"
          : "var(--color-text-secondary)",
      )
      .attr("opacity", 0.8)
      .attr("class", styles.nodeCircle)
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on(
            "start",
            (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              const node = event.subject;
              node.fx = node.x;
              node.fy = node.y;
            },
          )
          .on(
            "drag",
            (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) => {
              const node = event.subject;
              node.fx = event.x;
              node.fy = event.y;
            },
          )
          .on(
            "end",
            (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) => {
              if (!event.active) simulation.alphaTarget(0);
              const node = event.subject;
              node.fx = undefined;
              node.fy = undefined;
            },
          ),
      );

    // Create labels (hidden by default, shown on hover)
    const labels = g
      .selectAll("text")
      .data(graphData.nodes)
      .enter()
      .append("text")
      .attr("class", styles.nodeLabel)
      .attr("fill", "var(--color-text-primary)")
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .text((d) => d.label)
      .attr("pointer-events", "none");

    // Create tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", styles.tooltip);

    tooltipRef.current = tooltip;

    nodes
      .on("mouseover", (_event: MouseEvent, d: GraphNode) => {
        // Show label
        labels.attr("class", (node) =>
          node.id === d.id ? styles.nodeLabelVisible : styles.nodeLabel,
        );

        // Show tooltip
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
        // Hide label
        labels.attr("class", styles.nodeLabel);

        // Hide tooltip
        tooltip.style("visibility", "hidden");
      });

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

    svg.call(zoom as any);

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
  }, [graphData, chargeStrength, linkDistance, collisionRadius]);

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
          height: "70vh",
        },
      }}
    >
      <Group gap="md" h="100%" align="flex-start" style={{ flex: 1 }}>
        {/* Left Panel - Physics Controls */}
        <Box className={styles.controlPanel}>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              View
            </Text>
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
              fullWidth
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
                fullWidth
              />
            )}
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Physics
            </Text>

            <Stack gap="0">
              <Text size="xs" c="dimmed">
                Repulsion
              </Text>
              <Slider
                value={chargeStrength}
                onChange={setChargeStrength}
                min={-500}
                max={0}
                step={10}
                marks={[
                  { value: -500, label: "Strong" },
                  { value: -250, label: "Med" },
                  { value: 0, label: "None" },
                ]}
                size="xs"
              />
            </Stack>

            <Stack gap="0">
              <Text size="xs" c="dimmed">
                Link Distance
              </Text>
              <Slider
                value={linkDistance}
                onChange={setLinkDistance}
                min={30}
                max={200}
                step={5}
                marks={[
                  { value: 30, label: "Close" },
                  { value: 115, label: "Med" },
                  { value: 200, label: "Far" },
                ]}
                size="xs"
              />
            </Stack>

            <Stack gap="0">
              <Text size="xs" c="dimmed">
                Collision
              </Text>
              <Slider
                value={collisionRadius}
                onChange={setCollisionRadius}
                min={20}
                max={80}
                step={2}
                marks={[
                  { value: 20, label: "Tight" },
                  { value: 50, label: "Med" },
                  { value: 80, label: "Loose" },
                ]}
                size="xs"
              />
            </Stack>
          </Stack>

          <Divider />

          <Group gap="xs">
            <Tooltip label="Refresh graph" position="right">
              <ActionIcon
                onClick={fetchGraphData}
                variant="subtle"
                size="sm"
                disabled={loading}
                loading={loading}
                flex={1}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Reset zoom" position="right">
              <ActionIcon
                onClick={handleResetZoom}
                variant="subtle"
                size="sm"
                flex={1}
              >
                <IconZoomReset size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>

        {/* Right Panel - Graph Canvas */}
        <div ref={containerRef} className={styles.container}>
          {loading ? (
            <Center h="100%">
              <Loader size="lg" />
            </Center>
          ) : graphData && graphData.nodes.length > 0 ? (
            <svg ref={svgRef} className={styles.canvas} />
          ) : (
            <Center h="100%">
              <Text c="dimmed" size="sm">
                No graph data available
              </Text>
            </Center>
          )}
        </div>
      </Group>
    </Modal>
  );
}
