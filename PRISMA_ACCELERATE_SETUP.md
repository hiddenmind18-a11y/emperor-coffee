# Prisma Accelerate Setup Guide for Vercel + Neon

This guide shows how to set up Prisma Accelerate to reduce database connections and data consumption, preventing the "Limit reached" error on Neon.

## 🎯 Why Prisma Accelerate?

**The Problem:**
- Vercel Serverless functions create many database connections
- Each request opens a new PostgreSQL connection
- This consumes network bandwidth quickly on Neon
- Can lead to "Limit reached" errors

**The Solution:**
- Prisma Accelerate provides intelligent connection pooling
- Caches queries between Vercel and Neon
- Reduces data transfer by up to 90%
- Automatically manages connection lifecycle

---

## 📋 Prerequisites

- Prisma account (free or paid): https://www.prisma.io/cloud
- Neon database account
- Vercel project
- Your Neon database connection string

---

## 🚀 Step-by-Step Setup

### Step 1: Sign Up for Prisma Cloud

1. Go to https://cloud.prisma.io
2. Sign up or log in
3. Create a new project (or use existing)
4. Navigate to **Project Settings** → **Accelerate**

### Step 2: Connect Prisma Accelerate to Neon

1. In Prisma Cloud, click **"Create Accelerate connection"**
2. Choose **Neon PostgreSQL** as your database provider
3. Enter your Neon connection string:
   ```
   postgresql://neondb_owner:npg_Lb6CFeydB2jx@ep-dawn-heart-agcyndmo-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Click **"Create connection"**
5. Prisma will provide you with:
   - **Accelerate URL** (starts with `prisma://`)
   - **Direct URL** (your original Neon connection string)

⚠️ **Important:** Save both URLs! You'll need them for Vercel configuration.

### Step 3: Update Your Project Environment Variables

In your project, you'll have two scenarios:

#### Local Development (SQLite)
Your `.env` file should use SQLite:
```env
DATABASE_URL="file:../db/custom.db"
```

#### Production (Vercel with Accelerate)
In Vercel Dashboard → Settings → Environment Variables, add:

**For Node.js 18+ / Edge Runtime:**
```
DATABASE_URL=prisma://your-accelerate-url-here
DIRECT_URL=postgresql://neondb_owner:npg_Lb6CFeydB2jx@ep-dawn-heart-agcyndmo-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

**What's the difference?**
- `DATABASE_URL`: Used by Prisma Client for normal queries (goes through Accelerate)
- `DIRECT_URL`: Used by Prisma Migrate and direct database operations

### Step 4: Update Your Prisma Schema (Optional but Recommended)

For optimal performance, you can update `prisma/schema.prisma`:

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

**Note:** The `directUrl` is optional but helps with migrations and some advanced features.

### Step 5: Deploy to Vercel

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Configure for Prisma Accelerate"
   git push
   ```

2. **Update Vercel Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add/update:
     - `DATABASE_URL` = Your Prisma Accelerate URL (`prisma://...`)
     - `DIRECT_URL` = Your Neon direct URL (`postgresql://...`)
   - Select all environments (Production, Preview, Development)
   - Click Save

3. **Redeploy:**
   - Vercel will automatically redeploy
   - Or manually trigger: Deployments → Redeploy

---

## ✅ Verification

After deployment, verify Accelerate is working:

### 1. Check Prisma Cloud Dashboard
- Go to your Prisma Cloud project
- Navigate to **Accelerate** → **Metrics**
- You should see:
  - Active connections
  - Query latency
  - Cache hit rate

### 2. Test Your Application
- Make requests to your Vercel deployment
- Check that data loads correctly
- Monitor for any connection errors

### 3. Monitor Neon Usage
- Go to Neon Dashboard
- Check **Data Transfer** metrics
- You should see reduced data consumption
- Network usage should be significantly lower

---

## 📊 Expected Results

After implementing Prisma Accelerate:

| Metric | Before Accelerate | After Accelerate |
|--------|-------------------|------------------|
| Database Connections | High (per request) | Low (pooled) |
| Data Transfer | High | Reduced by 60-90% |
| Query Latency | Variable | Improved with caching |
| Neon Limits | Frequent | Rarely hit |
| Cost | Higher | Lower |

---

## 🔧 Troubleshooting

### Issue: "P1001: Can't reach database server"

**Solution:**
- Verify `DIRECT_URL` is correct in Vercel environment variables
- Check Neon database status
- Ensure SSL mode is enabled (`?sslmode=require`)

### Issue: Accelerate not reducing data transfer

**Solutions:**
1. Check Prisma Cloud metrics - is Accelerate actually being used?
2. Verify `DATABASE_URL` starts with `prisma://`
3. Clear Prisma cache:
   ```bash
   rm -rf .prisma
   npx prisma generate
   ```

### Issue: Migration fails in production

**Solution:**
- Use `DIRECT_URL` for migrations, not `DATABASE_URL`
- Run migrations locally or from a Vercel Cron Job:
  ```bash
  DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
  ```

### Issue: Connection timeouts

**Solutions:**
1. Increase connection timeout in Prisma Client:
   ```typescript
   const prisma = new PrismaClient({
     log: ['query', 'error', 'warn'],
   })
   ```
2. Check Vercel function timeout (max 60s for Pro)
3. Monitor Prisma Cloud for slow queries

---

## 🎓 Best Practices

### 1. Connection Pooling
- Prisma Accelerate handles this automatically
- Don't create multiple Prisma Client instances
- Use the singleton pattern (already in your `src/lib/db.ts`)

### 2. Query Optimization
- Use `select` to fetch only needed fields
- Implement pagination for large datasets
- Use `include` sparingly (it creates JOINs)

### 3. Caching Strategy
- Accelerate caches frequently accessed data
- Consider adding application-level caching for static data
- Use `stale-while-revalidate` patterns

### 4. Monitoring
- Set up alerts in Prisma Cloud
- Monitor Neon dashboard regularly
- Track query performance metrics

### 5. Environment Management
- Use different Accelerate connections for:
  - Production
  - Preview/Development
  - Testing

---

## 💰 Pricing

### Prisma Accelerate
- **Free Tier:** 5GB data transfer/month
- **Paid Plans:** Start at $20/month for 50GB
- Usually pays for itself in reduced Neon costs

### Neon
- Serverless Postgres with connection pooling
- Free tier: 0.5GB storage, limited hours
- Paid plans: Shared or dedicated compute
- **With Accelerate, you stay on lower tiers longer!**

---

## 📚 Additional Resources

- [Prisma Accelerate Documentation](https://www.prisma.io/docs/data-platform/accelerate)
- [Vercel + Prisma Integration Guide](https://vercel.com/docs/integrations/prisma)
- [Neon Connection Pooling Guide](https://neon.tech/docs/guides/connection-pooling)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

---

## 🎯 Quick Reference

### Your Connection Strings

**Neon Direct URL:**
```
postgresql://neondb_owner:npg_Lb6CFeydB2jx@ep-dawn-heart-agcyndmo-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

**Prisma Accelerate URL:**
```
prisma://YOUR-ACCELERATE-URL-FROM-PRISMA-CLOUD
```

### Vercel Environment Variables

```
DATABASE_URL=prisma://YOUR-ACCELERATE-URL
DIRECT_URL=postgresql://neondb_owner:npg_Lb6CFeydB2jx@ep-dawn-heart-agcyndmo-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

---

## 🚀 Next Steps

1. ✅ Sign up for Prisma Cloud
2. ✅ Create Accelerate connection
3. ✅ Update Vercel environment variables
4. ✅ Deploy and test
5. ✅ Monitor and optimize

---

**Created for Emperor Coffee POS System**
*Reducing database costs and improving performance with Prisma Accelerate*

👑 **تمام!** Your friend was 100% right - Accelerate is the solution! 🎉
