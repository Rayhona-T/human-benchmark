import { usePageTitle } from "../app/usePageTitle";
import { Card } from "../components/ui/Card";
import { FLANKER_PROTOCOL_ID } from "../experiments/flanker/flanker";
import { STROOP_PROTOCOL_ID } from "../experiments/stroop/stroop";
import "./Page.css";

/** Version of the analysis definitions (also recorded in every CSV export). */
const ANALYSIS_VERSION = "HB-ANALYSIS-1.1";

interface Reference {
  /** Citation text without the DOI link. */
  citation: string;
  doi: string;
}

/**
 * FR-DIS-04 / NFR-SCI-01. Every entry is listed in
 * docs/scientific/LITERATURE_REVIEW.md §9 and was checked against Crossref
 * (authors, year, title, journal, volume, pages) in Cycle 10 Task 10.5. Add
 * only references verified the same way; never add one from memory.
 * Numbers are cited in the text above as [n].
 */
const REFERENCES: readonly Reference[] = [
  {
    citation:
      "Stroop, J. R. (1935). Studies of interference in serial verbal reactions. Journal of Experimental Psychology, 18(6), 643–662.",
    doi: "10.1037/h0054651",
  },
  {
    citation:
      "MacLeod, C. M. (1991). Half a century of research on the Stroop effect: An integrative review. Psychological Bulletin, 109(2), 163–203.",
    doi: "10.1037/0033-2909.109.2.163",
  },
  {
    citation:
      "Eriksen, B. A., & Eriksen, C. W. (1974). Effects of noise letters upon the identification of a target letter in a nonsearch task. Perception & Psychophysics, 16(1), 143–149.",
    doi: "10.3758/BF03203267",
  },
  {
    citation:
      "Eriksen, C. W. (1995). The flankers task and response competition: A useful tool for investigating a variety of cognitive problems. Visual Cognition, 2(2–3), 101–118.",
    doi: "10.1080/13506289508401726",
  },
  {
    citation:
      "Fan, J., McCandliss, B. D., Sommer, T., Raz, A., & Posner, M. I. (2002). Testing the efficiency and independence of attentional networks. Journal of Cognitive Neuroscience, 14(3), 340–347.",
    doi: "10.1162/089892902317361886",
  },
  {
    citation:
      "Heitz, R. P. (2014). The speed-accuracy tradeoff: History, physiology, methodology, and behavior. Frontiers in Neuroscience, 8, 150.",
    doi: "10.3389/fnins.2014.00150",
  },
  {
    citation:
      "Hedge, C., Powell, G., & Sumner, P. (2018). The reliability paradox: Why robust cognitive tasks do not produce reliable individual differences. Behavior Research Methods, 50(3), 1166–1186.",
    doi: "10.3758/s13428-017-0935-1",
  },
  {
    citation:
      "Reimers, S., & Stewart, N. (2015). Presentation and response timing accuracy in Adobe Flash and HTML5/JavaScript Web experiments. Behavior Research Methods, 47(2), 309–327.",
    doi: "10.3758/s13428-014-0471-1",
  },
  {
    citation:
      "Bridges, D., Pitiot, A., MacAskill, M. R., & Peirce, J. W. (2020). The timing mega-study: Comparing a range of experiment generators, both lab-based and online. PeerJ, 8, e9414.",
    doi: "10.7717/peerj.9414",
  },
  {
    citation:
      "Anwyl-Irvine, A., Dalmaijer, E. S., Hodges, N., & Evershed, J. K. (2021). Realistic precision and accuracy of online experiment platforms, web browsers, and devices. Behavior Research Methods, 53(4), 1407–1425.",
    doi: "10.3758/s13428-020-01501-5",
  },
];

export function MethodologyPage() {
  usePageTitle("Methodology");

  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Scientific methodology</p>
        <h1>How to interpret the platform</h1>
        <p className="page-intro">
          HUMAN BENCHMARK is educational and research-inspired. It does not
          provide diagnostic, clinical, or intelligence judgments.
        </p>
      </header>

      <div className="methodology-grid">
        <Card>
          <p className="page-card-label">Measure</p>
          <h2>Task behavior</h2>
          <p>
            Browser-recorded sessions may observe accuracy and reaction time for
            a particular protocol, device, and stimulus set.
          </p>
        </Card>
        <Card>
          <p className="page-card-label">Timing</p>
          <h2>Browser limitations</h2>
          <p>
            Browser timestamps do not measure physical photon onset or guarantee
            laboratory-grade timing across devices.
          </p>
        </Card>
        <Card>
          <p className="page-card-label">Interpretation</p>
          <h2>No general ability score</h2>
          <p>
            Condition differences are task observations, not stable traits,
            diagnosis, IQ, rankings, or a combined cognitive score.
          </p>
        </Card>
      </div>

      <section className="page-section" aria-labelledby="methodology-tasks">
        <h2 id="methodology-tasks">The two experiments</h2>
        <div className="page-card-grid methodology-pair">
          <Card>
            <p className="page-card-label">Protocol {STROOP_PROTOCOL_ID}</p>
            <h3>Stroop</h3>
            <p>
              A word appears in colored ink, and you press the key for the ink
              color while ignoring what the word says. Responses are often
              slower or less accurate when the word names a different color than
              its ink. Stroop described this interference in 1935 [1], and it
              has been studied extensively since [2].
            </p>
            <p>
              This is an adaptation: the original study used spoken responses to
              whole lists, while here each word is a separate keyboard trial [1,
              2].
            </p>
          </Card>
          <Card>
            <p className="page-card-label">Protocol {FLANKER_PROTOCOL_ID}</p>
            <h3>Flanker</h3>
            <p>
              Five symbols appear in a row, and you press the key for the
              direction of the center arrow while ignoring the others. Responses
              are often slower or less accurate when the surrounding symbols
              point the other way. The task comes from Eriksen and Eriksen
              (1974), who used letters rather than arrows [3], and has since
              been used to study attention and competing responses [4].
            </p>
            <p>
              Arrow versions are used in later tasks such as the Attention
              Network Test [5]. The dashes in this version&apos;s neutral
              condition are a HUMAN BENCHMARK choice that has not been formally
              evaluated or validated.
            </p>
          </Card>
        </div>
      </section>

      <section className="page-section" aria-labelledby="methodology-evidence">
        <h2 id="methodology-evidence">
          What research supports, and what we decided
        </h2>
        <div className="page-card-grid methodology-pair">
          <Card>
            <p className="page-card-label">From published research</p>
            <h3>General findings</h3>
            <ul className="methodology-list">
              <li>
                Both effects are well-established differences between
                conditions, observed across groups of people [2, 4, 7].
              </li>
              <li>
                A robust group effect is not a reliable score for comparing
                individuals: repeat-testing studies of both tasks found poor
                reliability for individual differences [7].
              </li>
              <li>
                Speed and accuracy can trade off against each other [6], so
                results always show both.
              </li>
              <li>
                Studies using external measuring equipment found that browser
                timing can be useful, but its accuracy depends on the software,
                browser, operating system, and device [8–10].
              </li>
            </ul>
          </Card>
          <Card>
            <p className="page-card-label">HUMAN BENCHMARK decisions</p>
            <h3>Our implementation choices</h3>
            <ul className="methodology-list">
              <li>
                The number of trials, their timing, the response keys, the
                colors, fonts, and words, and the neutral stimuli.
              </li>
              <li>
                How results are summarized and when a value is shown (analysis
                definitions {ANALYSIS_VERSION}).
              </li>
              <li>
                How pauses, interruptions, and invalid trials are handled.
              </li>
              <li>
                These choices are informed by the research above, but this
                combination has not been validated. The cited studies did not
                test HUMAN BENCHMARK&apos;s tasks.
              </li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="page-note" aria-labelledby="methodology-versions">
        <h2 id="methodology-versions">Versions</h2>
        <p>
          Each session follows a fixed, approved protocol: {STROOP_PROTOCOL_ID}{" "}
          for Stroop and {FLANKER_PROTOCOL_ID} for Flanker. Results are
          calculated with the analysis definitions {ANALYSIS_VERSION}. Every
          downloaded CSV file records the protocol and analysis version it was
          produced with. Approval means the project owner accepted the protocol;
          it does not mean scientific or clinical validation.
        </p>
      </section>

      <section
        className="page-section"
        aria-labelledby="methodology-references"
      >
        <h2 id="methodology-references">References</h2>
        <p className="methodology-references__note">
          Bibliographic details were checked against Crossref. The references
          support the general findings described above; they do not validate
          HUMAN BENCHMARK&apos;s tasks.
        </p>
        <ol className="methodology-references">
          {REFERENCES.map((reference) => (
            <li key={reference.doi}>
              {reference.citation}{" "}
              <a href={`https://doi.org/${reference.doi}`}>
                https://doi.org/{reference.doi}
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-note">
        <h2>Transparency and safeguards</h2>
        <p>
          Scientific explanations should distinguish established findings,
          protocol choices, and future validation. Participant-facing content
          should remain explicit about uncertainties and accessibility limits.
        </p>
      </section>
    </div>
  );
}
