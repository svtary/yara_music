import { readWebConfig } from '@yara/config';

import { DevelopmentShell } from '../components/layout/development-shell';

export default function WebFoundationPage() {
  const config = readWebConfig(process.env);

  return <DevelopmentShell apiBaseUrl={config.apiBaseUrl} environment={config.nodeEnv} />;
}
