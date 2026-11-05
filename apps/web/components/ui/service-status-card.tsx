'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Flex, Space, Tag, Typography } from 'antd';

import { fetchHealth, type HealthProbe } from '../../lib/health';
import { ErrorState, LoadingState } from './async-state';

interface ServiceStatusCardProps {
  readonly label: string;
  readonly probe: HealthProbe;
}

export function ServiceStatusCard({ label, probe }: ServiceStatusCardProps) {
  const query = useQuery({
    queryKey: ['health', probe],
    queryFn: () => fetchHealth(probe),
  });

  return (
    <Card className="yara-status-card" variant="borderless">
      <Flex align="center" justify="space-between" gap={12}>
        <Typography.Text className="yara-card-label">{label}</Typography.Text>
        {!query.isPending && !query.isError ? (
          <Tag bordered={false} className={`yara-status-tag is-${query.data.status}`}>
            {query.data.status === 'ok' ? 'Available' : 'Degraded'}
          </Tag>
        ) : null}
      </Flex>

      {query.isPending ? <LoadingState label={`Checking ${label}`} /> : null}
      {query.isError ? (
        <ErrorState
          description="The local API did not answer this probe. Check the API container and try again."
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {!query.isPending && !query.isError ? (
        <Space className="yara-status-content" direction="vertical" size={8}>
          <Typography.Title level={3}>{query.data.service.toUpperCase()}</Typography.Title>
          <Typography.Text type="secondary">
            {probe === 'live'
              ? 'The canonical API process is responding.'
              : 'PostgreSQL, pg_trgm, and pgvector are ready.'}
          </Typography.Text>
          {query.data.checks ? (
            <Flex wrap="wrap" gap={6}>
              {Object.entries(query.data.checks).map(([check, status]) => (
                <Tag bordered={false} key={check}>
                  {check} · {status}
                </Tag>
              ))}
            </Flex>
          ) : null}
        </Space>
      ) : null}
    </Card>
  );
}
