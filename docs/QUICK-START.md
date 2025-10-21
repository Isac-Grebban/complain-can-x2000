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

## ⚙️ Step 3: Configure Your App

**Edit file**: `src/config.js`

Replace these two lines:
```javascript
GITHUB_TOKEN: 'YOUR_GITHUB_TOKEN',  // ← Paste your token here
GIST_ID: 'YOUR_GIST_ID',           // ← Paste your gist ID here
```

**Example**:
```javascript
GITHUB_TOKEN: 'ghp_1234567890abcdef...',
GIST_ID: 'abc123def456ghi789jkl012',
```

---

## 🌐 Step 4: Enable GitHub Pages

**Option A: Repository Settings** (Recommended)
1. Go to your repo: https://github.com/andreas-heige-grebban/complain-can
2. **Settings** tab → **Pages** (left sidebar)
3. **Source**: "Deploy from a branch"
4. **Branch**: `main`, **Folder**: `/ (root)`
5. **Save** 💾

**Option B: Auto-deploy via GitHub Actions**
- Just push your changes - the workflow is already configured!

---

## 🧪 Step 5: Test Your Deployment

1. **Commit and push** your config changes
2. **Wait 2-5 minutes** for deployment
3. **Visit**: https://andreas-heige-grebban.github.io/complain-can/
4. **Test**:
   - Add some coins
   - Refresh the page
   - Coins should persist! 🎉

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "GitHub token not configured" | Check token is correctly pasted in `src/config.js` |
| "Gist not found" | Verify gist ID and that gist is public |
| "Access denied" | Ensure token has `gist` scope |
| Data not persisting | Check browser console for error messages |

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