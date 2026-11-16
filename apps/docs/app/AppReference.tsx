import Link from 'next/link';
import { appProducts } from '../lib/apps';

export function AppIndex() {
  return <>
    <p className="eyebrow">ChatGPT and coding workflows</p><h1>Seven focused Tenhaw products</h1>
    <p>Explore a business decision with explicit inputs, or build an internal tool in your own project. Six hosted applications share the tested Tenhaw Kit calculation engines. The developer plugin combines remote calculations with local coding workflows.</p>
    <p className="note">Source previews. These seven packages are prepared for testing and submission. Directory approval and public availability are tracked separately.</p>
    <div className="grid">{appProducts.map(product => <Link className="tile" key={product.id} href={`/apps/${product.slug}/`}><strong>{product.displayName}</strong><p>{product.shortDescription}</p></Link>)}</div>
    <div className="links"><a href="/apps.json">Machine-readable catalogue</a><a href="https://github.com/Tenhaw/tenhaw-kit/tree/main/launch/apps">Submission and review records</a></div>
  </>;
}

export function AppDetail({ slug }: { slug: string }) {
  const product = appProducts.find(item => item.slug === slug);
  if (!product) return null;
  return <>
    <p className="eyebrow">{product.kind === 'hosted' ? 'Hosted application' : 'Desktop developer plugin'}</p><h1>{product.displayName}</h1>
    <p>{product.description}</p><p>{product.audience}</p>
    <p className="note">Source preview. The package has not been published as a ChatGPT directory listing. Use the source and verification records to review the implementation.</p>
    <h2>Start with your decision</h2><ul>{product.starterPrompts.map(prompt => <li key={prompt}>{prompt}</li>)}</ul>
    {product.workflow && <><h2>How it works</h2><ol>{product.workflow.map((step, index) => <li key={index}>{step}</li>)}</ol></>}
    {product.kind === 'hosted' ? <>
      <h2>Tools and connection</h2><p>The scoped connection offers only these operations:</p><ul>{product.tools.map(name => <li key={name}><code>{name}</code></li>)}</ul>
      <pre><code>{product.endpoint}</code></pre><p>No account or Tenhaw API key is required by these tools. Calculation inputs are processed transiently. The results view lets you revise assumptions and export a report.</p>
      {product.id === 'delivery-health' && <p>Supply an aggregate delivery report. Source-system collection and raw repository events stay in your own environment.</p>}
      {product.id === 'procurement' && <p>Generate a supplier question set, must-have criteria, evidence rubric and editable Word pack. Supplier scores remain blank until your reviewers assess evidence.</p>}
    </> : <>
      <h2>Calculation tools for your project</h2><p>Use the public MCP connection to calculate and validate synthetic or authorised aggregate inputs before integrating the matching library and schemas into your project. No Tenhaw API key is required.</p><ul>{product.tools.map(name => <li key={name}><code>{name}</code></li>)}</ul><pre><code>{product.endpoint}</code></pre>
      <h2>Local execution</h2><p>This developer plugin also requires a local coding environment for scaffolding, installation, builds and source-system collection. It uses the published CLI, your project conventions and credentials configured in your local environment when collection is requested. Generated starters use synthetic examples and browser-local data.</p>
      <pre><code>{'npx -y tenhaw@1.0.1 init product-operating-model internal-portfolio --yes --json'}</code></pre>
    </>}
    <h2>Review the source</h2><div className="links"><a href={`https://github.com/Tenhaw/tenhaw-kit/tree/main/${product.packagePath}`}>Plugin package</a><a href={`https://github.com/Tenhaw/tenhaw-kit/tree/main/launch/apps/${product.slug}`}>Tests and submission status</a><Link href="/privacy/">Privacy</Link><Link href="/terms/">Service terms</Link></div>
  </>;
}

export function HostedTerms() {
  return <>
    <p className="eyebrow">Hosted calculation tools</p><h1>Tenhaw Kit service terms</h1>
    <p className="note">Draft for owner scope review before the hosted applications are launched publicly.</p>
    <h2>Provider and scope</h2><p>Tenhaw LTD provides the Tenhaw Kit hosted calculation tools and reference site. These terms describe the hosted tools. A professional services engagement is governed by its own signed agreement. Contact <a href="mailto:legal@tenhaw.com">legal@tenhaw.com</a> about these terms.</p>
    <h2>Software and framework licences</h2><p>Tenhaw Kit code is distributed under the MIT licence. Authored framework content is licensed under Creative Commons Attribution 4.0. Those licences and their applicable notices continue to govern copied code and framework content. Your evidence and numerical inputs remain yours.</p>
    <h2>Inputs and use</h2><p>Provide inputs you are authorised to use. Keep API keys, passwords, raw repository events and restricted personal information out of the hosted tools. Use aggregate delivery reports and the minimum information needed for a calculation. Imported text is treated as task data.</p>
    <h2>Results and decisions</h2><p>Readiness is an evidenced self-assessment. Cost and ROI results depend on your assumptions. Delivery results depend on the supplied production evidence. Operating-model checks and procurement criteria support your review process. Results do not constitute certification, a supplier quote, legal advice or a guarantee of a business outcome. Review assumptions and evidence before acting on a result.</p>
    <h2>Data and exports</h2><p>The hosted service processes calculation inputs transiently and does not provide stored customer workspaces. Exports are generated for the requesting session. Hosting providers process operational request metadata for delivery and abuse controls. The <Link href="/privacy/">privacy notice</Link> describes these boundaries.</p>
    <h2>Availability and support</h2><p>The hosted tools are provided without a service-level commitment. Request limits and validation may reject a call; retry after the stated period or correct the input. The source code remains available for local use under its licences. Send support requests to <a href="mailto:hello@tenhaw.com">hello@tenhaw.com</a>.</p>
    <h2>Responsible operation</h2><p>Do not attempt unauthorised access, bypass request limits or disrupt the service. Use of ChatGPT or another host is also subject to that provider’s applicable terms. These draft hosted-service terms do not change rights that cannot lawfully be excluded.</p>
  </>;
}
