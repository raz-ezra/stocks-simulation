# Deployment Guide

This app is configured for deployment to GitHub Pages.

## Automatic Deployment (Recommended)

The repository includes a GitHub Actions workflow that automatically deploys to GitHub Pages when you push to the `main` branch.

### Setup Steps:

1. **Push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" in the sidebar
   - Under "Source", select "GitHub Actions"
   - The workflow will automatically deploy your app

3. **Access your deployed app**:
   - Your app will be available at: `https://[your-username].github.io/stocks-simulation/`

## Manual Deployment

If you prefer to deploy manually:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Deploy**:
   ```bash
   npm run deploy
   ```

This will build the app and push it to the `gh-pages` branch.

## Configuration Notes

- The app is configured with `base: '/stocks-simulation/'` in `vite.config.ts`
- If you rename your repository, update the `base` path accordingly
- All routes and assets are properly configured for GitHub Pages subdirectory deployment

## Environment Variables

For production deployment with real API keys:

1. In your repository settings, go to "Secrets and variables" → "Actions"
2. Add your secrets:
   - `VITE_POLYGON_API_KEY`: Your Polygon.io API key

The app will work in demo mode without API keys, but real stock prices require a Polygon.io API key.

## Troubleshooting

- **404 on refresh**: GitHub Pages doesn't support client-side routing by default. The app uses hash routing to work around this.
- **Assets not loading**: Ensure the `base` path in `vite.config.ts` matches your repository name
- **Build fails**: Check that all dependencies are properly listed in `package.json`