'use client';

import { Alert, Button, Card, Flex, Layout, Space, Tag, Typography } from 'antd';

import { EmptyState } from '../ui/async-state';
import { ServiceStatusCard } from '../ui/service-status-card';

const { Content, Footer, Header } = Layout;

interface DevelopmentShellProps {
  readonly apiBaseUrl: string;
  readonly environment: string;
}

export function DevelopmentShell({ apiBaseUrl, environment }: DevelopmentShellProps) {
  return (
    <Layout className="yara-shell">
      <Header className="yara-header">
        <a className="yara-brand" href="/" aria-label="Yara development home">
          <span aria-hidden="true" className="yara-brand-mark" />
          <span>Yara</span>
        </a>
        <Tag bordered={false}>Development</Tag>
      </Header>

      <Content className="yara-content">
        <main className="yara-main">
          <section className="yara-intro" aria-labelledby="page-title">
            <Typography.Text className="yara-eyebrow">YARA · MVP-0</Typography.Text>
            <Typography.Title id="page-title" level={1}>
              A quiet foundation for the music ahead.
            </Typography.Title>
            <Typography.Paragraph>
              Stage 1 begins with the Web UI foundation: warm, editorial, readable, and ready for
              the canonical music search flow that follows.
            </Typography.Paragraph>
            <Flex wrap="wrap" gap={8}>
              <Tag bordered={false} className="yara-accent-tag">
                Stage 1 · In progress
              </Tag>
              <Tag bordered={false}>Task 1.1 · Web UI Foundation</Tag>
            </Flex>
          </section>

          <section className="yara-status-section" aria-labelledby="status-heading">
            <div className="yara-section-heading">
              <Typography.Text className="yara-eyebrow">LOCAL SYSTEM</Typography.Text>
              <Typography.Title id="status-heading" level={2}>
                Foundation status
              </Typography.Title>
            </div>

            <div className="yara-status-grid">
              <Card className="yara-status-card yara-web-card" variant="borderless">
                <Flex align="center" justify="space-between" gap={12}>
                  <Typography.Text className="yara-card-label">WEB STATUS</Typography.Text>
                  <Tag bordered={false} className="yara-status-tag is-ok">
                    Available
                  </Tag>
                </Flex>
                <Space className="yara-status-content" direction="vertical" size={8}>
                  <Typography.Title level={3}>NEXT.JS</Typography.Title>
                  <Typography.Text type="secondary">
                    App Router, React Server Components, and Ant Design SSR styles are active.
                  </Typography.Text>
                </Space>
              </Card>

              <ServiceStatusCard label="API LIVENESS" probe="live" />
              <ServiceStatusCard label="API READINESS" probe="ready" />

              <Card className="yara-status-card yara-environment-card" variant="borderless">
                <Typography.Text className="yara-card-label">ENVIRONMENT</Typography.Text>
                <Space className="yara-status-content" direction="vertical" size={8}>
                  <Typography.Title level={3}>{environment.toUpperCase()}</Typography.Title>
                  <Typography.Text type="secondary">Canonical API: {apiBaseUrl}</Typography.Text>
                  <Button href="/api/health/ready">Open readiness JSON</Button>
                </Space>
              </Card>
            </div>
          </section>

          <Alert
            className="yara-scope-alert"
            message="UI foundation only"
            description="Catalog, Search, Detail pages, AI, RAG, Recommendation, and Memory are not implemented in Task 1.1."
            showIcon
            type="info"
          />

          <section className="yara-foundation-section" aria-labelledby="foundation-heading">
            <Card className="yara-foundation-card" variant="borderless">
              <Typography.Text className="yara-eyebrow">DESIGN FOUNDATION</Typography.Text>
              <Typography.Title id="foundation-heading" level={2}>
                Music first. Interface second.
              </Typography.Title>
              <Typography.Paragraph>
                Yara keeps AI quiet and lets typography, hierarchy, warm surfaces, and music objects
                carry the experience.
              </Typography.Paragraph>
              <Flex wrap="wrap" gap={8}>
                <Tag bordered={false}>Inter · Sans-serif</Tag>
                <Tag bordered={false}>Warm neutral surfaces</Tag>
                <Tag bordered={false}>Orange · active states</Tag>
              </Flex>
            </Card>

            <Card className="yara-state-card" variant="borderless">
              <Typography.Text className="yara-card-label">EMPTY PRIMITIVE</Typography.Text>
              <EmptyState
                title="No product data yet"
                description="Task 1.2 will introduce canonical Catalog objects."
              />
            </Card>
          </section>
        </main>
      </Content>

      <Footer className="yara-footer">
        <Typography.Text type="secondary">
          Yara · Music is what feelings sound like.
        </Typography.Text>
      </Footer>
    </Layout>
  );
}
