'use client';

import { Alert, Button, Skeleton, Space, Typography } from 'antd';

export function LoadingState({ label = 'Loading' }: Readonly<{ label?: string }>) {
  return (
    <div className="yara-async-state" aria-live="polite" aria-label={label} role="status">
      <Skeleton active paragraph={{ rows: 2 }} title={{ width: '42%' }} />
    </div>
  );
}

export function ErrorState({
  description,
  onRetry,
}: Readonly<{ description: string; onRetry?: () => void }>) {
  return (
    <Alert
      action={
        onRetry ? (
          <Button size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
      description={description}
      message="Unable to load status"
      showIcon
      type="warning"
    />
  );
}

export function EmptyState({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <Space className="yara-empty-state" direction="vertical" size={4} role="status">
      <Typography.Text strong>{title}</Typography.Text>
      <Typography.Text type="secondary">{description}</Typography.Text>
    </Space>
  );
}
