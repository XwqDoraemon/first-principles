# First Principles - AI-Powered Thinking Coach

<div align="center">

![First Principles](https://img.shields.io/badge/First%20Principles-AI%20Coach-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Cloudflare](https://img.shields.io/badge/deployment-Cloudflare%20Pages-orange)

**Think through any problem in 15 minutes**

Not an AI chatbot. A Socratic thinking coach — 8 to 10 precise questions that help you find your own answer.

[Live Demo](https://first-principles.pages.dev) • [Pricing](https://first-principles.pages.dev/pricing) • [Documentation](#features)

</div>

---

## 🧠 What is First Principles?

First Principles is an AI-powered thinking framework that helps you break down complex problems using first-principles thinking. Through 5 structured phases, you'll:

1. **Understand** - Grasp the core problem
2. **Deconstruct** - Break down assumptions
3. **Rebuild** - Build from first principles
4. **Act** - Define clear actions
5. **Complete** - Summary with shareable mind map

---

## ✨ Features

- 🎯 **5-Phase Framework** - Structured thinking process
- 💬 **AI-Powered** - Powered by DeepSeek AI
- 💰 **Credit System** - Pay-per-use pricing
- 🗺️ **Mind Maps** - Visual thinking maps
- 📱 **Responsive Design** - Works on all devices
- 🔒 **Secure** - Row-level security with Supabase
- 🌍 **Global CDN** - Deployed on Cloudflare Pages

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- PayPal or Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/XwqDoraemon/first-principles.git
cd first-principles

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev
```

Access at http://localhost:4322

---

## 📁 Project Structure

```
first-principles/
├── server/
│   ├── index.cjs                 # Express server (local dev)
│   └── public-placeholder/       # Static files
│       ├── index.html
│       ├── chat.html
│       ├── pricing.html
│       └── js/
│           ├── payment.js
│           └── paypal-payment.js
├── supabase/
│   ├── functions/
│   │   ├── chat/                 # Chat API
│   │   ├── payment/              # Stripe integration
│   │   └── payment-paypal/       # PayPal integration
│   └── migrations/
│       └── 001_create_users_and_credits.sql
├── wrangler.toml                 # Cloudflare Pages config
└── README.md
```

---

## 🔧 Configuration

### Supabase Setup

1. **Create Supabase Project**
   - Visit https://supabase.com
   - Create a new project

2. **Run Database Migrations**
   ```sql
   -- Copy and run supabase/migrations/001_create_users_and_credits.sql
   ```

3. **Deploy Edge Functions**
   ```bash
   supabase functions deploy chat
   supabase functions deploy payment
   supabase functions deploy payment-paypal
   ```

### Payment Setup

#### PayPal

1. Get API credentials from https://developer.paypal.com
2. Add to Supabase environment variables:
   ```bash
   PAYPAL_CLIENT_ID=your_client_id
   PAYPAL_CLIENT_SECRET=your_client_secret
   PAYPAL_MODE=sandbox
   ```

#### Stripe (Optional)

1. Get API keys from https://dashboard.stripe.com
2. Add to Supabase environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## 🌐 Deployment

### Cloudflare Pages (Recommended)

1. **Connect GitHub Repository**
   - Visit https://dash.cloudflare.com/
   - Workers & Pages → Create application
   - Connect to Git → Select repository

2. **Configure Build**
   ```
   Build command: (leave empty)
   Build output directory: server/public-placeholder
   ```

3. **Deploy**
   - Save and Deploy
   - Access at https://first-principles.pages.dev

See [CLOUDFLARE_PAGES_DEPLOYMENT.md](CLOUDFLARE_PAGES_DEPLOYMENT.md) for details.

---

## 💰 Pricing

| Plan | Price | Credits | Cost per Session |
|------|-------|---------|------------------|
| Free | $0 | 2 | $0 |
| Basic Pack | $0.99 | 5 | ~$0.20 |
| Pro Pack | $4.99 | 30 | ~$0.17 |

**New users get 2 free sessions!**

---

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: Supabase PostgreSQL
- **AI**: DeepSeek API
- **Payments**: PayPal, Stripe
- **Hosting**: Cloudflare Pages
- **CDN**: Cloudflare

---

## 📖 Documentation

- [Deployment Guide](CLOUDFLARE_PAGES_DEPLOYMENT.md)
- [PayPal Setup](PAYPAL_SETUP.md)
- [Stripe Setup](STRIPE_SETUP.md)
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👤 Author

**Boss (XwqDoraemon)**

- GitHub: [@XwqDoraemon](https://github.com/XwqDoraemon)

---

## 🙏 Acknowledgments

- DeepSeek AI for the powerful language model
- Supabase for the amazing backend infrastructure
- Cloudflare for global CDN
- PayPal and Stripe for payment processing

---

## 📧 Contact

For support, email xuewq983@gmail.com or open an issue on GitHub.

---

<div align="center">

**Made with ❤️ by First Principles Team**

[⭐ Star](https://github.com/XwqDoraemon/first-principles) · [🍴 Fork](https://github.com/XwqDoraemon/first-principles/fork) · [🐛 Report Bug](https://github.com/XwqDoraemon/first-principles/issues)

</div>
