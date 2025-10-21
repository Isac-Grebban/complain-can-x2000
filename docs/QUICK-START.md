# 🚀 Quick Start Guide - GitHub Pages Deployment

**Goal**: Deploy your Complain Can app to GitHub Pages with shared data storage via GitHub Gists.

**Time needed**: ~10 minutes

## 📋 Prerequisites

- GitHub account with repository access
- Basic familiarity with GitHub (creating tokens, gists)

## 🗺️ Overview

1. **Create GitHub Token** (2 minutes)
2. **Create Data Gist** (2 minutes) 
3. **Configure App** (2 minutes)
4. **Enable GitHub Pages** (2 minutes)
5. **Test Deployment** (2 minutes)

---

## 🔑 Step 1: Create GitHub Personal Access Token

**Why**: Allows the app to read/write data to GitHub Gists

1. **Visit**: https://github.com/settings/tokens/new
2. **Token name**: `Complain Can Gist Access`
3. **Expiration**: 90 days (or your preference)
4. **Scopes**: ✅ Check **only** `gist`
5. **Generate token** and **copy it immediately** 📋

> ⚠️ **Important**: Save this token securely - you won't see it again!

---

## 📄 Step 2: Create GitHub Gist for Data Storage

**Why**: This acts as your "database" for storing coin counts

1. **Visit**: https://gist.github.com/
2. **Create new gist** with:
   - **Filename**: `coins.json`
   - **Content**: 
   ```json
   {
     "total": 0,
     "members": {
       "Isac": 0,
       "Hannah": 0,
       "Andreas": 0,
       "Karl": 0,
       "Daniel": 0,
       "Doug": 0,
       "Marina": 0
     },
     "updated": null
   }
   ```
   - **Visibility**: ✅ **Public** (required)
3. **Create gist** and **copy the ID** from URL
   - URL: `https://gist.github.com/yourusername/abc123def456`
   - ID: `abc123def456` 📋

---

## ⚙️ Step 3: Configure Repository Secrets

**Instead of putting secrets in code, use GitHub repository secrets:**

1. **Go to your repository**: https://github.com/Isac-Grebban/complain-can-x2000
2. **Settings** → **Secrets and variables** → **Actions**
3. **Add two repository secrets**:
   - **Name**: `GITHUB_GIST_TOKEN`, **Value**: Your GitHub token from Step 1
   - **Name**: `GIST_ID`, **Value**: Your gist ID from Step 2

**Why this is better:**
- ✅ **Secrets never appear in your code**
- ✅ **GitHub Actions automatically injects them during deployment**
- ✅ **More secure than committing tokens**

---

## 🌐 Step 4: Enable GitHub Pages with GitHub Actions

**Use GitHub Actions for automatic deployment** (handles secrets securely):

1. **Go to your repository**: https://github.com/Isac-Grebban/complain-can-x2000
2. **Settings** → **Pages** (left sidebar)
3. **Source**: Select "GitHub Actions"
4. **Done!** The workflow will automatically deploy when you push changes

**Why GitHub Actions?**
- ✅ **Automatically injects your secrets** from Step 3
- ✅ **Builds the app with your configuration**
- ✅ **Deploys to GitHub Pages securely**

---

## 🧪 Step 5: Test Your Deployment

1. **Commit and push** your changes (no secrets in code!)
2. **Go to Actions tab** to watch the deployment progress
3. **Wait 2-5 minutes** for GitHub Actions to complete
4. **Visit your site**: https://isac-grebban.github.io/complain-can-x2000/
5. **Test**:
   - Add some coins
   - Refresh the page
   - Coins should persist! 🎉

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "GitHub token not configured" | Check repository secrets are set correctly |
| "Gist not found" | Verify `GIST_ID` secret matches your gist ID |
| "Access denied" | Ensure `GITHUB_GIST_TOKEN` has `gist` scope |
| Deployment failed | Check **Actions** tab for build errors |
| Data not persisting | Check browser console for error messages |

### 🔍 **Check Deployment Status**
1. **Go to Actions tab** in your repository
2. **Click on latest workflow run** to see details
3. **Check if secrets were properly injected**

---

## 🔄 What's Next?

- **Share the URL** with your team
- **Customize** team member names in the gist
- **Monitor usage** via the gist's revision history
- **Local development**: See [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md)

---

## 📚 More Information

- **Detailed setup**: [SETUP.md](./SETUP.md)
- **Local development**: [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md)
- **Project structure**: [README.md](../README.md)

---

**🎉 That's it! Your Complain Can is now live and ready for team use!**