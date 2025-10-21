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

## 3. Configure the Application

1. Open `src/config.js` in your repository
2. Replace `YOUR_GITHUB_TOKEN` with your Personal Access Token from step 1
3. Replace `YOUR_GIST_ID` with your Gist ID from step 2
4. Update `GITHUB_USERNAME` if needed

Example:
```javascript
GITHUB_TOKEN: 'ghp_1234567890abcdef...', // Your actual token
GIST_ID: 'abc123def456ghi789jkl012', // Your actual gist ID
GITHUB_USERNAME: 'your-github-username', // Your GitHub username
```

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

### Common Issues:

1. **"GitHub token not configured" error**
   - Check that your token is correctly set in `src/config.js`
   - Ensure the token has `gist` scope

2. **"Gist not found" error**
   - Verify the Gist ID is correct in `src/config.js`
   - Make sure the gist is public
   - Check that the gist contains a file named `coins.json`

3. **"Access denied" error**
   - Verify your GitHub token is valid and not expired
   - Ensure the token has `gist` scope
   - Check that you own the gist or have access to it

4. **Data not persisting**
   - Check browser console for error messages
   - Verify the gist structure matches the expected format
   - Test the gist API directly: `https://api.github.com/gists/YOUR_GIST_ID`

### Testing Locally

You can test the app locally by:
1. Serving the files with a local web server (not just opening index.html)
2. Using Python: `python -m http.server 8000`
3. Or using Node.js: `npx serve .`
4. Open `http://localhost:8000` in your browser

### Backup Your Token

Store your GitHub token securely. If you lose it, you'll need to generate a new one and update your configuration.