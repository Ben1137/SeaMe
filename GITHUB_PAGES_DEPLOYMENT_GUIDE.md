# 🚀 SeaMe - GitHub Pages Deployment Guide

This guide will help you deploy your SeaMe app to GitHub Pages so your friends can test it as a beta version.

## 📋 Prerequisites

- Your code is already on GitHub at: https://github.com/Ben1137/SeaMe
- You have push access to the repository
- Node.js and npm are installed locally (for testing)

## 🔧 Step 1: Update Your Repository Files

### 1.1 Update `vite.config.ts`

Replace your existing `vite.config.ts` with this content:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/SeaMe/", // Important: This should match your GitHub repo name
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
});
```

**Why this change?** The `base: '/SeaMe/'` tells Vite to generate URLs that work on GitHub Pages (username.github.io/SeaMe/).

### 1.2 Create GitHub Actions Workflow

Create a new directory structure and file:
`.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "./dist"

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## 🎯 Step 2: Enable GitHub Pages

1. Go to your repository: https://github.com/Ben1137/SeaMe
2. Click on **Settings** (top menu)
3. In the left sidebar, click on **Pages** (under "Code and automation")
4. Under **Source**, select **GitHub Actions**
5. Save the changes

## 📤 Step 3: Deploy Your App

### Option A: Push Changes (Automatic Deployment)

```bash
# Add the new files
git add .github/workflows/deploy.yml
git add vite.config.ts

# Commit the changes
git commit -m "Configure GitHub Pages deployment"

# Push to GitHub
git push origin main
```

The deployment will start automatically!

### Option B: Manual Deployment

1. Go to your repository on GitHub
2. Click on **Actions** tab
3. Select **Deploy to GitHub Pages** workflow
4. Click **Run workflow** button
5. Select branch: `main`
6. Click **Run workflow**

## ✅ Step 4: Access Your Deployed App

After deployment completes (usually 2-3 minutes), your app will be available at:

**🌐 https://ben1137.github.io/SeaMe/**

## 🔍 Monitoring Deployment

1. Go to the **Actions** tab in your repository
2. You'll see the deployment workflow running
3. Green checkmark ✅ = successful deployment
4. Red X ❌ = deployment failed (check logs)

## 🐛 Troubleshooting

### Problem: Build Fails

**Solution:** Check that your `package.json` has all required dependencies:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

### Problem: App Shows Blank Page

**Solution:** Make sure the `base` path in `vite.config.ts` matches your repo name exactly:

- ✅ Correct: `base: '/SeaMe/'`
- ❌ Wrong: `base: '/seame/'` (case matters!)
- ❌ Wrong: `base: '/SeaMe'` (missing trailing slash!)

### Problem: Assets Not Loading

**Solution:** Check browser console for 404 errors. Ensure all imports use relative paths, not absolute paths.

### Problem: API Calls Fail

**Solution:** If you're using any backend APIs, make sure:

1. CORS is properly configured
2. API endpoints use HTTPS (not HTTP)
3. API keys are not hardcoded (use environment variables)

## 🔄 Updating Your App

Every time you push changes to the `main` branch, GitHub Actions will automatically:

1. Build your app
2. Deploy the new version to GitHub Pages
3. Make it available within 2-3 minutes

Just commit and push:

```bash
git add .
git commit -m "Update: describe your changes"
git push origin main
```

## 🎨 Custom Domain (Optional)

Want to use a custom domain like `seame.yourdomain.com`?

1. In **Settings** → **Pages**
2. Add your custom domain in the **Custom domain** field
3. Follow GitHub's instructions to configure DNS

## 📱 Sharing with Friends

Share this URL with your friends:
**https://ben1137.github.io/SeaMe/**

They can:

- Access it from any device (desktop, mobile, tablet)
- Bookmark it for easy access
- Test all features in real-time
- No installation needed!

## 🔐 Beta Testing Tips

1. **Collect Feedback:** Add a feedback button/form in your app
2. **Track Issues:** Use GitHub Issues for bug reports
3. **Version Control:** Use git tags for beta versions (v0.1-beta, v0.2-beta)
4. **Analytics:** Consider adding Google Analytics or similar for usage tracking

## 📊 Build Status Badge

Add this to your README.md to show deployment status:

```markdown
[![Deploy to GitHub Pages](https://github.com/Ben1137/SeaMe/actions/workflows/deploy.yml/badge.svg)](https://github.com/Ben1137/SeaMe/actions/workflows/deploy.yml)
```

## 🎉 Success!

Your SeaMe app is now live and ready for beta testing! 🌊

---

## Need Help?

If you encounter any issues:

1. Check the **Actions** tab for deployment logs
2. Review this guide's troubleshooting section
3. Check Vite's documentation: https://vitejs.dev/guide/static-deploy.html
4. GitHub Pages docs: https://docs.github.com/en/pages

Happy Testing! 🚀
