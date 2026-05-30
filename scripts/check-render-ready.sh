#!/bin/bash

# Render-ga deploy qilishdan oldin tekshirish
echo "🔍 Render Deployment Preparation Check..."
echo ""

# 1. Node version check
echo "✅ Node.js version:"
node --version
pnpm --version
echo ""

# 2. package.json check
echo "✅ Build va Start scripts:"
grep -A 2 '"build"' package.json
grep -A 2 '"start"' package.json
echo ""

# 3. .env.local files
echo "✅ Environment variables:"
if [ -f .env.local ]; then
  echo "   .env.local mavjud ✓"
  echo "   (DATABASE_URL: $(grep DATABASE_URL .env.local))"
  echo "   (JWT_SECRET: $(grep JWT_SECRET .env.local))"
else
  echo "   ⚠️  .env.local topilmadi"
fi
echo ""

# 4. render.yaml check
echo "✅ Render config:"
if [ -f render.yaml ]; then
  echo "   render.yaml mavjud ✓"
else
  echo "   ⚠️  render.yaml topilmadi"
fi
echo ""

# 5. .gitignore check
echo "✅ Git configuration:"
if [ -f .gitignore ]; then
  echo "   .gitignore mavjud ✓"
  if grep -q "\.env\.local" .gitignore; then
    echo "   .env.local ignored ✓"
  else
    echo "   ⚠️  .env.local git-da track bo'lishi keraksiz!"
  fi
else
  echo "   ⚠️  .gitignore topilmadi"
fi
echo ""

# 6. Dependencies check
echo "✅ Muhim dependencies:"
echo "   - Next.js: $(grep '"next"' package.json)"
echo "   - React: $(grep '"react"' package.json | head -1)"
echo "   - PostgreSQL: $(grep '"pg"' package.json)"
echo ""

# 7. Database scripts check
echo "✅ Database migration scripts:"
if [ -f scripts/01-setup-auth-tables.sql ]; then
  echo "   scripts/01-setup-auth-tables.sql mavjud ✓"
else
  echo "   ⚠️  Migration script topilmadi"
fi
echo ""

# 8. Git status
echo "✅ Git repository:"
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "   Git repo initialized ✓"
  echo "   Remote: $(git config --get remote.origin.url)"
else
  echo "   ⚠️  Git repo initialize qilinmagan"
  echo "   Qadam: git init && git remote add origin YOUR_REPO_URL"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Keyingi Qadam: Render.com-da Blueprint Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
