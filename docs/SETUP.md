# GitHub Pages Setup Instructions

**📋 Looking for a quick visual guide? See [QUICK-START.md](./QUICK-START.md) for a step-by-step walkthrough!**

---

Follow these detailed steps to deploy your Complain Can app to GitHub Pages:

## 1. Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens/new)
2. Click "Generate new token (classic)"
3. Give it a descriptive name like "Complain Can Gist Access"
4. Select the `gist` scope (this allows reading and writing gists)
5. Click "Generate token"
6. **Copy the token immediately** (you won't be able to see it again)

## 2. Create a GitHub Gist for Data Storage

1. Go to [https://gist.github.com/](https://gist.github.com/)
2. Create a new gist with:
   - **Filename**: `coins.json`
   - **Content**: Copy the content from your `data/coins.json` file
   - Make sure it's **Public** (required for GitHub Pages to access it)
3. Click "Create public gist"
4. **Copy the Gist ID** from the URL (e.g., if URL is `https://gist.github.com/username/abc123def456`, the ID is `abc123def456`)

## 3. Configure Repository Secrets

**DO NOT edit any code files.** Instead, add secrets to your GitHub repository:

1. Go to your repository on GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add these two secrets:
   
   **Secret 1:**
   - Name: `GIST_TOKEN`
   - Value: Your Personal Access Token from step 1
   
   **Secret 2:**
   - Name: `GIST_ID`
   - Value: Your Gist ID from step 2

**Why repository secrets?**
- ✅ Secrets never appear in your code
- ✅ More secure than hardcoding tokens
- ✅ GitHub Actions automatically injects them during deployment

## 4. Deploy to GitHub Pages

### Option A: Enable GitHub Pages in Repository Settings
1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll down to "Pages" section
4. Under "Source", select "Deploy from a branch"
5. Select "main" branch and "/ (root)" folder
6. Click "Save"

### Option B: Use GitHub Actions (Recommended)
1. Create `.github/workflows/pages.yml` file (already included)
2. Commit and push your changes
3. GitHub Actions will automatically deploy your site

## 5. Test Your Deployment

1. Wait a few minutes for deployment to complete
2. Visit your GitHub Pages URL: `https://your-username.github.io/complain-can/`
3. Test adding coins and verify they persist across page refreshes
4. Check browser console for any errors

## Security Notes

- The GitHub token is visible in your client-side code, which is normal for this setup
- Use a token with minimal scope (only `gist`)
- The gist must be public for GitHub Pages to access it
- Consider the security implications for your use case

## Troubleshooting

For comprehensive troubleshooting, see the [QUICK-START.md troubleshooting section](./QUICK-START.md#-troubleshooting) which includes solutions for common deployment issues.

### Local Testing

Test the app locally with:
```bash
./dev-server.sh
# Open: http://localhost:8080/index-dev.html (development mode)
# Or: http://localhost:8080/index.html (production mode)
```