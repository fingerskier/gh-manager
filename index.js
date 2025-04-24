import 'dotenv/config';
import express from 'express';
import { Octokit } from '@octokit/rest';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.static('ux'));
app.use(express.json());

// Routes
app.get('/api/issues', async (req, res) => {
  try {
    const { token, org, repo } = req.query;
    if (!token || !org || !repo) {
      return res.status(400).json({ error: 'GitHub token, organization name, and repository name are required' });
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.listForRepo({
      owner: org,
      repo: repo,
      state: 'all',
      per_page: 100
    });
    res.json(data);
  } catch (error) {
    console.error('Issues fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

app.get('/api/actions', async (req, res) => {
  try {
    const { token, org, repo } = req.query;
    if (!token || !org || !repo) {
      return res.status(400).json({ error: 'GitHub token, organization name, and repository name are required' });
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner: org,
      repo: repo,
      per_page: 100
    });
    res.json(data);
  } catch (error) {
    console.error('Build fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch build statuses' });
  }
});

app.get('/api/releases', async (req, res) => {
  try {
    const { token, org, repo } = req.query;
    if (!token || !org || !repo) {
      return res.status(400).json({ error: 'GitHub token, organization name, and repository name are required' });
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.listReleases({
      owner: org,
      repo: repo,
      per_page: 50
    });
    res.json(data);
  } catch (error) {
    console.error('Release fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch releases' });
  }
});

app.get('/api/repositories', async (req, res) => {
  try {
    const { token, org, visibility = 'private' } = req.query;
    if (!token || !org) {
      return res.status(400).json({ error: 'GitHub token and organization name are required' });
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.listForOrg({
      org: org,
      per_page: 100,
      sort: 'updated',
      direction: 'desc',
      type: visibility
    });
    res.json(data);
  } catch (error) {
    console.error('Repository fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch repositories',
      details: error.message
    });
  }
});

app.get('/api/repo-summary', async (req, res) => {
  try {
    const { token, org, repos } = req.query;
    if (!token || !org || !repos) {
      return res.status(400).json({ error: 'GitHub token, organization name, and repository names are required' });
    }

    const repoNames = repos.split(',');
    if (!repoNames.length) {
      return res.status(400).json({ error: 'At least one repository name is required' });
    }

    const octokit = new Octokit({ auth: token });
    const summaryPromises = repoNames.map(async (repoName) => {
      const [issues, builds, releases] = await Promise.all([
        octokit.rest.issues.listForRepo({
          owner: org,
          repo: repoName,
          state: 'open',
          per_page: 5
        }),
        octokit.rest.actions.listWorkflowRunsForRepo({
          owner: org,
          repo: repoName,
          per_page: 1
        }),
        octokit.rest.repos.listReleases({
          owner: org,
          repo: repoName,
          per_page: 1
        })
      ]);

      return {
        name: repoName,
        openIssues: issues.data.length,
        latestBuild: builds.data.workflow_runs[0] ? {
          status: builds.data.workflow_runs[0].conclusion,
          name: builds.data.workflow_runs[0].name,
          created_at: builds.data.workflow_runs[0].created_at
        } : null,
        latestRelease: releases.data[0] ? {
          name: releases.data[0].name,
          published_at: releases.data[0].published_at
        } : null
      };
    });

    const summaries = await Promise.all(summaryPromises);
    res.json(summaries);
  } catch (error) {
    console.error('Summary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch repository summaries' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
