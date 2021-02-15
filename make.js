const fs = require("fs").promises;

const main = async () => {
  const file = await fs.open("Bible.dat");

  const header = Buffer.alloc(1584);
  await file.read(header, 0, 1584);

  const bookHeader = Buffer.alloc(1);
  const chapterHeader = Buffer.alloc(1);
  const verseHeader = Buffer.alloc(2);

  const names = [];

  let offset = 0;
  while (offset < 1584) {
    const name = header
      .slice(offset, offset + 20)
      .toString()
      .trim()
      .replace(/\0/g, "");
    names.push([name, name.toLowerCase()]);
    const bookStart = header.slice(offset + 20, offset + 24).readUInt32BE(0);

    await file.read(bookHeader, 0, 1, bookStart);
    const chapters = bookHeader.readUInt8();

    const bookHeaderChapterData = Buffer.alloc(3 * chapters);
    await file.read(bookHeaderChapterData, 0, 3 * chapters, bookStart + 1);

    let chapter = 0;

    while (chapter < chapters) {
      let chapterOffset =
        Buffer.concat([
          Buffer.from([0x0]),
          bookHeaderChapterData.slice(chapter * 3, (chapter + 1) * 3),
        ]).readUInt32BE() + bookStart;

      await file.read(chapterHeader, 0, 1, chapterOffset);
      const verses = chapterHeader.readUInt8();

      // We read the number of verses in, so advance the offset
      chapterOffset += 1;

      const chapterPath = `docs/${name.toLowerCase()}/${chapter + 1}`;

      let verse = 0;
      while (verse < verses) {
        await fs.mkdir(`${chapterPath}/${verse + 1}`, { recursive: true });

        await file.read(verseHeader, 0, 2, chapterOffset);
        const verseBytes = verseHeader.readUInt16BE();

        const verseData = Buffer.alloc(verseBytes);
        await file.read(verseData, 0, verseBytes, chapterOffset + 2);

        await fs.writeFile(
          `${chapterPath}/${verse + 1}/index.html`,
          `<html lang="en">
<head>
  <title>${name} ${chapter + 1}:${verse + 1}</title>
  <link rel="stylesheet" href="../../../verse.css">
</head>
<body>
  <div id="container">
    <div id="wrapper">
      <div id="metadata">${name} ${chapter + 1}:${verse + 1}</div>
      <div id="verse">${verseData.toString()}</div>
    </div>
  </div>
</body>
</html>`
        );

        // Advance the chapter offset by the verse size header and the verse
        // string contents.
        chapterOffset += verseBytes + 2;

        verse += 1;
      }

      await fs.writeFile(
        `${chapterPath}/index.html`,
        `<html lang="en">
      <head>
        <title>${name} ${chapter + 1}</title>
        <link rel="stylesheet" href="../../chapter.css">
      </head>
      <body>
        <div id="container">
          <div id="wrapper">
            <div id="metadata">${name} ${chapter + 1}</div>
            <ul>
${[...Array(verses)]
  .map(
    (_, i) =>
      `            <li class="verse"><a href="${i + 1}/">Verse ${
        i + 1
      }</a></li>`
  )
  .join("\n")}
            </ul>
          </div>
        </div>
      </body>
      </html>`
      );

      chapter += 1;
    }

    await fs.writeFile(
      `docs/${name.toLowerCase()}/index.html`,
      `<html lang="en">
    <head>
      <title>${name}</title>
      <link rel="stylesheet" href="../book.css">
    </head>
    <body>
      <div id="container">
        <div id="wrapper">
          <div id="metadata">${name}</div>
          <ul>
${[...Array(chapters)]
  .map(
    (_, i) =>
      `            <li class="chapter"><a href="${i + 1}/">Chapter ${
        i + 1
      }</a></li>`
  )
  .join("\n")}
          </ul>
        </div>
      </div>
    </body>
    </html>`
    );

    offset += 24;
  }

  await fs.writeFile(
    `docs/index.html`,
    `<html lang="en">
  <head>
    <title>King James Bible</title>
    <link rel="stylesheet" href="bible.css">
  </head>
  <body>
    <div id="container">
      <div id="wrapper">
        <div id="metadata">King James Bible</div>
        <ul>
${names
  .map(
    ([full, lower]) =>
      `            <li class="book"><a href="${lower}/">${full}</a></li>`
  )
  .join("\n")}
        </ul>
      </div>
    </div>
  </body>
  </html>`
  );

  await file.close();
};

try {
  main();
} catch (e) {
  console.log(e);
}
