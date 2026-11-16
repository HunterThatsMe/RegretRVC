import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_VERSION,
  BRAND_NAME,
  DEFAULT_PROJECTS,
  DEFAULT_STUDIO_STATE,
} from './src/data/defaults.ts';
import type { SamplingRate, TunnelMode, Vocoder } from './src/types/studio.ts';
import { generateKaggleNotebookJson } from './src/utils/forkGenerator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Direct Kaggle Import Notebook Link endpoint (.ipynb JSON)
  const serveNotebookHandler = (req: express.Request, res: express.Response) => {
    const q = req.query;
    const baseProj = { ...DEFAULT_PROJECTS[0] };
    const baseCfg = { ...DEFAULT_STUDIO_STATE.forkConfig };

    if (typeof q.model === 'string' && q.model.trim()) {
      baseProj.name = q.model.trim();
    }
    if (q.sr === '32000' || q.sr === '40000' || q.sr === '48000') {
      baseProj.samplingRate = q.sr as SamplingRate;
    }
    if (
      q.vocoder === 'HiFi-GAN' ||
      q.vocoder === 'MRF HiFi-GAN' ||
      q.vocoder === 'RefineGAN'
    ) {
      baseProj.vocoder = q.vocoder as Vocoder;
    }
    if (q.precision === 'fp16' || q.precision === 'fp32') {
      baseProj.fp16 = q.precision === 'fp16';
    }
    if (q.tunnel === 'Horizon' || q.tunnel === 'Gradio + Cloudflare') {
      baseCfg.tunnelMode = q.tunnel as TunnelMode;
    }
    if (
      q.backup === 'huggingface' ||
      q.backup === 'google-drive' ||
      q.backup === 'both' ||
      q.backup === 'none'
    ) {
      baseCfg.backupProvider = q.backup;
    }
    if (typeof q.hfRepo === 'string' && q.hfRepo.trim()) {
      baseCfg.hfRepoId = q.hfRepo.trim();
    }

    const notebookJson = generateKaggleNotebookJson(
      baseCfg,
      baseProj,
      DEFAULT_STUDIO_STATE.downloadManifest
    );

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${BRAND_NAME}_Kaggle.ipynb"`
    );
    res.send(notebookJson);
  };

  app.get('/NoRegretsRVC_Kaggle.ipynb', serveNotebookHandler);
  app.get('/api/notebook/NoRegretsRVC_Kaggle.ipynb', serveNotebookHandler);

  // Live GitHub release / commit checker for Settings -> Check for updates
  app.get('/api/check-updates', async (_req, res) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const relResp = await fetch(
        'https://api.github.com/repos/IAHispano/Applio/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': `${BRAND_NAME}-UpdateChecker`,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      let latestTag = APP_VERSION;
      let publishedAt = '';
      let releaseUrl = 'https://github.com/IAHispano/Applio/releases';

      if (relResp.ok) {
        const relData = (await relResp.json()) as {
          tag_name?: string;
          published_at?: string;
          html_url?: string;
        };
        if (relData.tag_name) latestTag = relData.tag_name.replace(/^v/, '');
        if (relData.published_at) publishedAt = relData.published_at;
        if (relData.html_url) releaseUrl = relData.html_url;
      }

      const commitResp = await fetch(
        'https://api.github.com/repos/IAHispano/Applio/commits/main',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': `${BRAND_NAME}-UpdateChecker`,
          },
        }
      );
      let latestCommit = '';
      let commitDate = '';
      if (commitResp.ok) {
        const commitData = (await commitResp.json()) as {
          sha?: string;
          commit?: { author?: { date?: string } };
        };
        if (commitData.sha) latestCommit = commitData.sha.slice(0, 7);
        if (commitData.commit?.author?.date) commitDate = commitData.commit.author.date;
      }

      const newestVersion = APP_VERSION;
      res.json({
        ok: true,
        currentVersion: APP_VERSION,
        newestVersion,
        latestTag: newestVersion,
        upstreamTag: latestTag,
        latestCommit,
        publishedAt: publishedAt || commitDate,
        releaseUrl,
        upToDate: true,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(200).json({
        ok: false,
        currentVersion: APP_VERSION,
        newestVersion: APP_VERSION,
        error:
          err instanceof Error ? err.message : 'Unable to reach GitHub API right now.',
        checkedAt: new Date().toISOString(),
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`${BRAND_NAME} server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
