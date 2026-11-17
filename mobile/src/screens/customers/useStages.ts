import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listCustomStages } from '../../api/customers';
import { buildStages } from '../../lib/stages';

/** Built-in + custom CRM stages, like the web's useEffectivePipelineStages. */
export function useStages() {
  const custom = useQuery({ queryKey: ['pipeline-stages'], queryFn: listCustomStages, staleTime: 5 * 60_000 });
  return useMemo(() => buildStages(custom.data?.stages ?? []), [custom.data]);
}
