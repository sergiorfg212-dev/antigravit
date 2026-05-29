import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // API Route to send password recovery emails via SMTP
  app.post("/api/send-recovery-email", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Faltan parámetros obligatorios email y código." });
      }

      let smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || `"Plataforma NOM-030" <no-reply-nom030@empresa.com>`;

      // Robust check: detect if SMTP_HOST contains a google API key or is invalid
      if (smtpHost && (smtpHost.startsWith("AIzaSy") || !smtpHost.includes(".") || smtpHost === "undefined" || smtpHost === "")) {
        console.warn(`[MAIL SERVICE WARNING] SMTP_HOST posee un formato de API Key o es inválido (${smtpHost}). Reemplazándolo por "smtp.gmail.com" temporalmente.`);
        smtpHost = "smtp.gmail.com";
      }

      if (!smtpUser || !smtpPass || smtpUser.startsWith("AIzaSy") || smtpPass.startsWith("AIzaSy") || smtpUser === "undefined") {
        console.warn("[MAIL SERVICE WARNING] SMTP_USER o SMTP_PASS no están configurados correctamente o contienen una API Key de Google por error.");
        return res.json({ 
          success: false, 
          error: "credentials_missing",
          message: "El servidor de correo no posee credenciales válidas en las variables de entorno (SMTP_USER y SMTP_PASS). Se usará simulación local."
        });
      }

      // Configure nodemailer transporter
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for 587 or others
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 5000, // 5 seconds timeout to prevent hanging
      });

      const mailOptions = {
        from: smtpFrom,
        to: email,
        subject: "🔒 Código de Seguridad - Recuperación de Contraseña",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 40px;">🔒</span>
              <h2 style="color: #1e293b; margin: 10px 0 0 0; font-family: sans-serif; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase; font-size: 20px;">Recuperación de Acceso</h2>
              <p style="color: #64748b; font-size: 13px; margin: 5px 0 0 0;">Plataforma de Diagnóstico NOM-030-STPS-2009</p>
            </div>
            
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              Hola,<br><br>
              Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de asesor/administrador técnico en el sistema.
            </p>
            
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 12px; text-align: center; margin-bottom: 24px; border: 1px dashed #cbd5e1;">
              <span style="color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 8px;">Código de seguridad de un solo uso</span>
              <strong style="color: #2563eb; font-size: 32px; font-family: monospace; letter-spacing: 6px; font-weight: 900; display: inline-block;">${code}</strong>
            </div>
            
            <p style="color: #ef4444; font-size: 11px; line-height: 1.5; margin-bottom: 20px; text-align: center;">
              <strong>Importante:</strong> Este código expirará pronto. Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
            <p style="text-align: center; color: #94a3b8; font-size: 11px; margin: 0;">
              No respondas a este correo. Generado automáticamente por el servidor NOM-030.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`[MAIL SERVICE SUCCESS] Correo enviado exitosamente a ${email}`);
      return res.json({ success: true, message: "Correo enviado exitosamente." });

    } catch (err: any) {
      console.error("[MAIL SERVICE ERROR] Error al enviar correo:", err);
      // Instead of 500, we can return success: false with details so the client doesn't crash 
      // and can fallback to console simulated code if needed for development.
      return res.json({ 
        success: false, 
        error: "smtp_error", 
        message: err.message || "Error al conectar con servidor SMTP" 
      });
    }
  });

  // API Proxy Route for Gemini
  app.post("/api/gemini", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("[GEMINI PROXY ERROR] GEMINI_API_KEY is not defined in environment variables!");
        return res.status(500).json({ error: "No se ha configurado la clave API GEMINI_API_KEY en el servidor." });
      }
      
      console.log(`[GEMINI PROXY] Incoming request. Model: ${model || "default"}. Key format: AIzaSy... (length: ${apiKey.length})`);
      
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const primaryModel = model || "gemini-3.5-flash";
      let response;
      try {
        console.log(`[GEMINI PROXY] Attempting generation with primary model: ${primaryModel}`);
        response = await ai.models.generateContent({
          model: primaryModel,
          contents,
          config
        });
      } catch (firstError: any) {
        console.warn(`[GEMINI PROXY WARNING] Primary model ${primaryModel} failed: ${firstError.message}. Trying backup model "gemini-2.5-flash"...`);
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config
          });
          console.log("[GEMINI PROXY SUCCESS] Response successfully received using backup model (gemini-2.5-flash).");
        } catch (fallbackError: any) {
          console.error("[GEMINI PROXY ERROR] All designated models failed to generate content.");
          throw firstError; // Throw the original error or fallbackError for troubleshooting
        }
      }
      
      console.log("[GEMINI PROXY SUCCESS] Response successfully received from Gemini.");
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("[GEMINI PROXY ERROR] Exception occurred during generation:", error);
      res.status(500).json({ 
        error: error.message || "Failed to generate content from Gemini proxy",
        details: error.stack
      });
    }
  });

  // Vite development vs production asset serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith("/api")) {
        return next();
      }
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
});
