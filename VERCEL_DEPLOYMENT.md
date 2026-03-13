# Vercel Deployment Guide for Emperor Coffee POS

## ✅ Configuration Status

Your project is ready for deployment with:
- ✅ New Neon PostgreSQL database (empty, ready to use)
- ✅ Prisma 6.19.2 configured
- ✅ Next.js 16.1.6 ready
- ✅ Schema synced

---

## 🚀 Deployment Steps

### Step 1: Connect GitHub to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository: `hiddenmind18-a11y/emperor-coffee`
4. Click **"Import"**

### Step 2: Configure Environment Variables

In Vercel Project Settings → Environment Variables, add:

```
DATABASE_URL=postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

DIRECT_DATABASE_URL=postgresql://neondb_owner:npg_5aEXZrwBPI8f@ep-patient-paper-aggs8d6r-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Important:** Select all environments (Production, Preview, Development)

### Step 3: Configure Build Settings

Vercel should auto-detect Next.js settings. Verify:

```
Framework Preset: Next.js
Build Command: bun run build
Output Directory: .next/standalone
Install Command: bun install
```

### Step 4: Deploy

Click **"Deploy"**

Vercel will:
1. Install dependencies
2. Generate Prisma Client
3. Build the application
4. Deploy to Vercel

---

## 📊 After Deployment

### Verify Database Connection

Visit your deployed URL and check the browser console for:
```
[DB] 🐘 Connecting to PostgreSQL directly
[DB] ✅ Prisma client initialized successfully
```

### Create Initial User

Since the database is empty, you'll need to create an initial user. You can:

1. **Use the seed script:**
   ```bash
   bun run db:seed
   ```

2. **Or create via API** (if you have a setup endpoint)

3. **Or manually insert into Neon Dashboard**

---

## 🎯 Important Notes

### About Your Data Proxy URL

You provided: `prisma+postgres://accelerate.prisma-data.net/?api_key=...`

This is **Prisma Data Proxy** format. It's a different product from **Prisma Accelerate**:

| Product | URL Format | Purpose |
|---------|-----------|---------|
| **Direct Connection** | `postgresql://...` | Direct to database |
| **Prisma Data Proxy** | `prisma+postgres://...` | Serverless-friendly (HTTP) |
| **Prisma Accelerate** | `prisma://...` | Connection pooling + caching |

**Currently configured:** Direct connection (working, tested ✅)

**To use Data Proxy later:**
1. Update `DATABASE_URL` to the `prisma+postgres://...` URL
2. May need schema adjustments
3. Redeploy

### About Your New Database

- **Status:** Empty (0 users, 0 branches)
- **Type:** Neon PostgreSQL 17.8
- **Connection:** Tested and working ✅
- **Location:** `ep-patient-paper-aggs8d6r-pooler.c-2.eu-central-1.aws.neon.tech`

---

## 🔧 Troubleshooting

### Issue: Build fails on Prisma

**Solution:**
```bash
# Run locally first
bunx prisma generate
bun run build
```

### Issue: Can't connect to database in production

**Solution:**
1. Verify environment variables in Vercel
2. Check they're selected for all environments
3. Redeploy after changes

### Issue: "Limit reached" on Neon

**Solution:**
- This is a new Neon account, so you have fresh limits
- Monitor usage in Neon Dashboard
- Consider upgrading if you hit limits

---

## 📚 Next Steps

1. ✅ Deploy to Vercel (follow steps above)
2. ✅ Create initial admin user
3. ✅ Set up branches and menu items
4. ✅ Test the full POS workflow

---

## 💡 Pro Tips

### 1. Monitoring
- Set up Vercel Analytics
- Monitor Neon database usage
- Check Prisma Cloud (if using Accelerate/Data Proxy)

### 2. Performance
- Use connection pooling (you have it with Neon pooler)
- Implement query caching
- Optimize database queries

### 3. Security
- Rotate API keys periodically
- Use Vercel Edge Functions for public APIs
- Enable rate limiting

---

**Good luck! Your project is ready to deploy! 🚀**
