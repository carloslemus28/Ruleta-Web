const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";

function randomString(len = 6) {
  return Math.random().toString(16).slice(2, 2 + len);
}

async function clickByText(driver, text) {
  const el = await driver.wait(
    until.elementLocated(By.xpath(`//button[contains(normalize-space(.),'${text}')]`)),
    15000
  );
  await driver.wait(until.elementIsVisible(el), 15000);
  await driver.wait(until.elementIsEnabled(el), 15000);
  await el.click();
}

async function acceptAlertIfPresent(driver, timeoutMs = 2000) {
  try {
    await driver.wait(until.alertIsPresent(), timeoutMs);
    const alert = await driver.switchTo().alert();
    await alert.accept();
  } catch (_) {
    // No hay alert, OK
  }
}

async function run() {
  const options = new chrome.Options();

  // En GitHub Actions no hay ventana (headless)
  if (process.env.CI) {
    options.addArguments(
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1366,768"
    );
  }

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  // Datos nuevos para no chocar con usuarios existentes
  const nombre = "Carlos";
  const apellido = "Test";
  const correo = `selenium_${randomString(8)}@test.com`;
  const contrasena = "123456";

  try {
    // 1) Abrir frontend (public)
    await driver.get(BASE_URL);

    // 2) Ir a Login desde Inicio
    await clickByText(driver, "Iniciar");

    // 3) Ir a Registro
    await clickByText(driver, "Registrarse");

    // 4) Llenar registro
    await driver.findElement(By.id("reg-nombre")).sendKeys(nombre);
    await driver.findElement(By.id("reg-apellido")).sendKeys(apellido);
    await driver.findElement(By.id("reg-correo")).sendKeys(correo);
    await driver.findElement(By.id("reg-pass")).sendKeys(contrasena);

    // 5) Enviar registro
    await clickByText(driver, "Registrarse");
    await acceptAlertIfPresent(driver, 4000); // "Registro exitoso..."

    // 6) Login
    await driver.findElement(By.id("login-correo")).sendKeys(correo);
    await driver.findElement(By.id("login-pass")).sendKeys(contrasena);
    await clickByText(driver, "Entrar");
    await acceptAlertIfPresent(driver, 4000); // "Inicio de sesión..."

    // 7) Verificar que estás en pantalla de juego (dashboard)
    const dashboard = await driver.wait(until.elementLocated(By.id("dashboard")), 15000);
    await driver.wait(until.elementIsVisible(dashboard), 15000);

    // 8) Apostar (color rojo, 10 coins)
    const tipoApuesta = await driver.findElement(By.id("tipo-apuesta"));
    await tipoApuesta.sendKeys("Color"); // Selecciona "Color"
    const valor = await driver.findElement(By.id("valor-apostado"));
    const monto = await driver.findElement(By.id("monto-apostado"));

    await valor.clear();
    await valor.sendKeys("rojo");

    await monto.clear();
    await monto.sendKeys("10");

    await clickByText(driver, "Girar Ruleta");

    // 9) Validar que hubo resultado
    const resultado = await driver.wait(until.elementLocated(By.id("resultado-jugada")), 15000);
    const texto = await resultado.getText();
    if (!texto || texto.trim().length < 3) {
      throw new Error("No se detectó texto de resultado en #resultado-jugada");
    }

    // 10) Abrir historial y validar que hay filas (mínimo 1)
    await clickByText(driver, "Ver Historial");
    const tabla = await driver.wait(until.elementLocated(By.id("tabla-historial")), 15000);

    // Buscar al menos una fila <tr> dentro del historial
    const rows = await tabla.findElements(By.css("tr"));
    if (rows.length < 2) {
      // normalmente 1 sería header; 2+ significa al menos 1 dato
      throw new Error("Historial no muestra filas de apuestas (o solo header).");
    }

    console.log("✅ E2E OK: registro, login, apuesta y verificación de historial.");
  } catch (err) {
    // Evidencia rápida si falla
    try {
      const png = await driver.takeScreenshot();
      const fs = require("fs");
      fs.mkdirSync("artifacts", { recursive: true });
      fs.writeFileSync("artifacts/fallo.png", png, "base64");
      console.log("📸 Screenshot guardado en artifacts/fallo.png");
    } catch (_) {}

    console.error("❌ E2E falló:", err.message || err);
    process.exitCode = 1;
  } finally {
    await driver.quit();
  }
}

run();
