import { describe, expect, it } from "vitest";

import { extractArticleBodyAndStyles, prepareArticleContentForNavigation } from "./article-content";

describe("prepareArticleContentForNavigation", () => {
  it("derives stable anchors and nested navigation labels from article headings", () => {
    const source = `
      <section>
        <h2 id="kurzantwort">Kurzantwort</h2>
        <h2>Prüfungsanbieter im Detail</h2>
        <div class="prov-card" id="prov-goethe">
          <div class="prov-header">
            <p class="prov-title">Goethe-Institut — Goethe-Zertifikat</p>
          </div>
        </div>
      </section>
    `;

    const first = prepareArticleContentForNavigation(source);
    const second = prepareArticleContentForNavigation(source);

    expect(first).toEqual(second);
    expect(first.tableOfContents).toEqual([
      { id: "kurzantwort", label: "Kurzantwort", level: 2 },
      {
        id: "artikel-pruefungsanbieter-im-detail",
        label: "Prüfungsanbieter im Detail",
        level: 2,
      },
      {
        id: "artikel-goethe-institut-goethe-zertifikat",
        label: "Goethe-Institut — Goethe-Zertifikat",
        level: 3,
      },
    ]);
    expect(first.content).toContain(
      '<h3 class="prov-title" id="artikel-goethe-institut-goethe-zertifikat" data-article-toc-heading="true">',
    );
  });

  it("adds CEFR badges to level-card navigation labels without duplicating visible text", () => {
    const source = `
      <h2>Niveaustufen im Detail</h2>
      <div class="level-card" id="lv-b2">
        <div class="card-header">
          <div class="level-badge">B2</div>
          <p class="card-title">Fließend und flexibel</p>
        </div>
      </div>
    `;

    const prepared = prepareArticleContentForNavigation(source);

    expect(prepared.tableOfContents[1]).toEqual({
      id: "artikel-b2-fliessend-und-flexibel",
      label: "B2 – Fließend und flexibel",
      level: 3,
    });
    expect(prepared.content).toContain(
      '>Fließend und flexibel</h3>',
    );
    expect(prepared.content).not.toContain(
      '>B2 – Fließend und flexibel</h3>',
    );
  });

  it("decodes entities, preserves existing generated headings and creates unique fallback anchors", () => {
    const prepared = prepareArticleContentForNavigation(`
      <h2 data-article-toc-heading="true" id="kept">Kept &amp; ready</h2>
      <h2>Äpfel &amp; Öl</h2>
      <h2>Äpfel &amp; Öl</h2>
      <h3><span>&#xDC;bung &#8211; &unknown;</span></h3>
      <h2>!!!</h2>
    `);

    expect(prepared.tableOfContents).toEqual([
      { id: "kept", label: "Kept & ready", level: 2 },
      { id: "artikel-aepfel-und-oel", label: "Äpfel & Öl", level: 2 },
      { id: "artikel-aepfel-und-oel-2", label: "Äpfel & Öl", level: 2 },
      { id: "artikel-uebung-und-unknown", label: "Übung – &unknown;", level: 3 },
      { id: "artikel-abschnitt", label: "!!!", level: 2 },
    ]);
    expect(prepared.content).not.toContain('id="artikel-aepfel-und-oel" id=');
  });

  it("extracts scoped styles from full documents and fragments", () => {
    const full = extractArticleBodyAndStyles(`
      <html><head><style>:root { color: red; }
body, .card { margin: 0; }
body.dark { color: black; }</style></head>
      <body><main>Artikel</main></body></html>
    `, "article-doc");

    expect(full.content.trim()).toBe("<main>Artikel</main>");
    expect(full.styles).toContain(".article-doc { color: red; }");
    expect(full.styles).toContain(".article-doc, .card");
    expect(full.styles).toContain(".article-doc.dark");

    const fragment = extractArticleBodyAndStyles("<style>body>.card{display:block}</style><section>Text</section>", "article-doc");
    expect(fragment.content).toContain("<section>Text</section>");
    expect(fragment.styles).toContain(".article-doc>.card");
  });
});
