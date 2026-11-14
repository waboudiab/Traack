/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer", "twilio", "mongodb"],
};

export default nextConfig;
