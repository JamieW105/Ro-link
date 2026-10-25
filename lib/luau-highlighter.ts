import { createHighlighterCoreSync } from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';
import luau from '@shikijs/langs/luau';
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';

// Load only Luau and two themes. The JavaScript engine avoids a WASM fetch in the editor.
export const luauHighlighter = createHighlighterCoreSync({
    langs: [luau],
    themes: [githubLight, githubDark],
    engine: createJavaScriptRegexEngine(),
});
