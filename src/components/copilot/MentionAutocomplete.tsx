import { useState, useEffect } from 'react';
import { Paper, Stack, Text, Group } from '@mantine/core';
import { IconHash, IconFile } from '@tabler/icons-react';
import { useBlockStore } from '../../stores/blockStore';
import { usePageStore } from '../../stores/pageStore';

export interface MentionSuggestion {
  type: 'block' | 'page' | 'keyword';
  uuid?: string;
  label: string;
  preview?: string;
}

interface Props {
  query: string;
  onSelect: (suggestion: MentionSuggestion) => void;
  position: { top: number; left: number };
}

export function MentionAutocomplete({ query, onSelect, position }: Props) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const blocksById = useBlockStore(state => state.blocksById);
  const pagesById = usePageStore(state => state.pagesById);

  useEffect(() => {
    // Search for blocks and pages matching query
    const results: MentionSuggestion[] = [];
    const lowerQuery = query.toLowerCase();

    // Add keyword suggestions
    if ('selection'.startsWith(lowerQuery)) {
      results.push({
        type: 'keyword',
        label: '@selection',
        preview: 'Reference current selection',
      });
    }

    if ('current'.startsWith(lowerQuery)) {
      results.push({
        type: 'keyword',
        label: '@current',
        preview: 'Reference focused block',
      });
    }

    // Search pages
    Object.values(pagesById).forEach(page => {
      if (page.title.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'page',
          uuid: page.id,
          label: page.title,
          preview: `@page:${page.id}`,
        });
      }
    });

    // Search blocks (limit to 10)
    // Note: iterating all blocks might be slow in large workspaces.
    // For now, this is client-side filtering. In future, use FTS via Tauri command.
    let blockCount = 0;
    for (const block of Object.values(blocksById)) {
      if (blockCount >= 10) break;
      if (block.content.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'block',
          uuid: block.id,
          label: block.content.slice(0, 50),
          preview: `@block:${block.id}`,
        });
        blockCount++;
      }
    }

    setSuggestions(results.slice(0, 10)); // Limit to 10 total
    setSelectedIndex(0);
  }, [query, blocksById, pagesById]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, suggestions, onSelect]);

  if (suggestions.length === 0) return null;

  return (
    <Paper
      shadow="md"
      p="xs"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1000,
        maxWidth: 400,
        width: '100%',
        maxHeight: 300,
        overflowY: 'auto',
      }}
    >
      <Stack gap="xs">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.preview || suggestion.label}
            onClick={() => onSelect(suggestion)}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor:
                index === selectedIndex
                  ? 'var(--color-bg-tertiary)'
                  : 'transparent',
              cursor: 'pointer',
            }}
          >
            <Group gap="xs">
              {suggestion.type === 'page' ? (
                <IconFile size={16} />
              ) : (
                <IconHash size={16} />
              )}
              <div style={{ flex: 1 }}>
                <Text size="sm" fw={500}>
                  {suggestion.label}
                </Text>
                {suggestion.preview && (
                  <Text size="xs" c="dimmed">
                    {suggestion.preview}
                  </Text>
                )}
              </div>
            </Group>
          </div>
        ))}
      </Stack>
    </Paper>
  );
}