import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Divider } from "../components/ui/Divider";
import { EmptyState } from "../components/ui/EmptyState";
import { Feedback } from "../components/ui/Feedback";
import {
  Checkbox,
  Label,
  Select,
  TextInput,
} from "../components/ui/FormControls";
import { Loading } from "../components/ui/Loading";
import { TextLink } from "../components/ui/TextLink";
import "./DesignSystemPage.css";
import { usePageTitle } from "../app/usePageTitle";

export function DesignSystemPage() {
  usePageTitle("Design system");
  return (
    <div className="design-system">
      <header>
        <p>Development preview</p>
        <h1>Design system</h1>
        <p className="design-system__intro">
          Core visual tokens and reusable UI primitives for a calm, scientific
          product interface.
        </p>
      </header>

      <Card elevated id="typography">
        <h2>Typography</h2>
        <h1>Primary heading</h1>
        <h2>Secondary heading</h2>
        <h3>Tertiary heading</h3>
        <p>
          Body text uses a readable system font with a measured line height.
        </p>
        <p className="mono">Monospace metadata and technical values</p>
      </Card>

      <section>
        <h2>Color tokens</h2>
        <div className="token-grid">
          {[
            ["Ink", "#111827", "var(--color-ink-900)"],
            ["Accent", "#1D4ED8", "var(--color-accent-700)"],
            ["Success", "#166534", "var(--color-success)"],
            ["Warning", "#92400E", "var(--color-warning)"],
            ["Error", "#991B1B", "var(--color-error)"],
            ["Information", "#1E40AF", "var(--color-info)"],
            ["Canvas", "#F8FAFC", "var(--surface-canvas)"],
            ["Surface", "#FFFFFF", "var(--surface-raised)"],
          ].map(([name, hex, token]) => (
            <div className="token-swatch" key={name}>
              <div
                className="token-swatch__color"
                style={{ background: hex }}
              />
              <strong>{name}</strong>
              <br />
              <span className="mono">{hex}</span>
              <br />
              <span>{token}</span>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      <div className="showcase-grid">
        <Card>
          <h2>Buttons</h2>
          <div className="showcase-stack">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button isLoading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>

        <Card>
          <h2>Badges</h2>
          <div className="showcase-stack">
            <Badge>Neutral</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="error">Error</Badge>
            <Badge tone="info">Information</Badge>
          </div>
        </Card>
      </div>

      <Card>
        <h2>Form controls</h2>
        <div className="showcase-field">
          <Label htmlFor="example-input" required>
            Participant label
          </Label>
          <TextInput
            id="example-input"
            placeholder="Enter a value"
            aria-describedby="example-error"
          />
          <span id="example-error">Optional helper text</span>
        </div>
        <div className="showcase-field">
          <Label htmlFor="example-select">Response option</Label>
          <Select id="example-select">
            <option>Option one</option>
            <option>Option two</option>
          </Select>
        </div>
        <Label htmlFor="example-checkbox">
          <Checkbox id="example-checkbox" /> I understand
        </Label>
      </Card>

      <div className="showcase-grid">
        <Card>
          <h2>Feedback states</h2>
          <div className="showcase-stack">
            <Feedback tone="success" title="Data recorded">
              The trial completed successfully.
            </Feedback>
            <Feedback tone="warning" title="Review required">
              Some trial data needs attention.
            </Feedback>
            <Feedback tone="error" title="Input not accepted">
              Choose a valid response.
            </Feedback>
            <Feedback tone="info" title="Session information">
              This observation is task-specific.
            </Feedback>
          </div>
        </Card>

        <Card>
          <h2>Loading and links</h2>
          <Loading label="Preparing session" />
          <Divider />
          <TextLink href="#typography">Read scientific context</TextLink>
        </Card>
      </div>

      <EmptyState
        title="No session data"
        action={<Button variant="secondary">Return to start</Button>}
      >
        A completed session will appear here.
      </EmptyState>
    </div>
  );
}
