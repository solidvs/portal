import { Box, Heading, Stack, Text } from '@solidvs/ui';
import type { ReactNode } from 'react';

/** Page header and body of the pages outside a project (Início, Projetos, Deploys, Stack). */
export function PageShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Box paddingBlock="space.24" paddingInline="space.24">
      <Stack space="space.24">
        <Stack space="space.4">
          <Heading size="large" as="h1">
            {title}
          </Heading>
          {description && <Text color="text.muted">{description}</Text>}
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}

export function Loading() {
  return <Text color="text.faint">Carregando…</Text>;
}
