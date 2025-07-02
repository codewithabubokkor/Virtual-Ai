// This is a fix for the @rollup/rollup-linux-x64-gnu error on Netlify
// It's a workaround that disables platform-specific optimizations that cause issues
// Source: https://answers.netlify.com/t/build-failing-with-error-cannot-find-module-rollup-rollup-linux-x64-gnu/97588

process.env.ROLLUP_SKIP_NODEJS_NATIVE = 'true';

// This file is imported by the build process to fix the issue
// No additional configuration needed
