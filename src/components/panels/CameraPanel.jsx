import { scanHtml } from '../../legacy/fragments';

export default function CameraPanel() {
  return <section id="panel-scan" className="panel" dangerouslySetInnerHTML={{ __html: scanHtml }} />;
}
