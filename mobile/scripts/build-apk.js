/**
 * Build Android APK locally without EAS.
 * Requires: Android SDK (Android Studio or command-line tools), JAVA_HOME set.
 * Run from mobile/: pnpm run build:apk
 *
 * If you see CMake "path has 193 characters / maximum 250" or "build.ninja still dirty",
 * ensure mobile/.npmrc is present (node-linker=hoisted) and run: pnpm install
 * so node_modules is hoisted and paths stay under the limit.
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const androidDir = path.join(root, "android");
const isWin = process.platform === "win32";
const gradlew = isWin ? "gradlew.bat" : "gradlew";

// Remove existing android so prebuild generates fresh SDK 53 project.
const androidDirPath = path.join(root, "android");
if (fs.existsSync(androidDirPath)) {
  console.log("Stopping Gradle daemon so android/ can be removed...");
  try {
    execSync(isWin ? "gradlew.bat --stop" : "./gradlew --stop", { cwd: androidDirPath, stdio: "ignore" });
  } catch (_) {}
  console.log("Removing existing android/ for clean prebuild...");
  try {
    execSync("pnpm dlx rimraf android", { cwd: root, stdio: "inherit" });
  } catch {
    try {
      fs.rmSync(androidDirPath, { recursive: true, maxRetries: 3 });
    } catch (e) {
      console.error("Could not remove android/. Close any app using it (IDE, terminal) and try again.", e.message);
      process.exit(1);
    }
  }
}
console.log("Step 1: Generating native Android project (expo prebuild)...");
execSync("npx expo prebuild --platform android --clean", {
  cwd: root,
  stdio: "inherit",
});

if (!fs.existsSync(androidDir)) {
  console.error("Prebuild did not create android/ directory.");
  process.exit(1);
}

// Inject workaround for Expo SDK 53: generated PackageList.java uses expo.core.ExpoModulesPackage
// but the class lives in expo.modules. Patch during Gradle compile.
const appBuildGradle = path.join(androidDir, "app", "build.gradle");
if (fs.existsSync(appBuildGradle)) {
  const gradlePatch = `
// Workaround: Expo SDK 53 autolinking generates expo.core.ExpoModulesPackage; class is in expo.modules.
tasks.whenTaskAdded { task ->
    if (task.name == "compileReleaseJavaWithJavac" || task.name == "compileDebugJavaWithJavac") {
        task.doFirst {
            def packageList = file("\${buildDir}/generated/autolinking/src/main/java/com/facebook/react/PackageList.java")
            if (packageList.exists()) {
                def text = packageList.getText("UTF-8")
                if (text.contains("expo.core.ExpoModulesPackage")) {
                    packageList.write(text.replace("expo.core.ExpoModulesPackage", "expo.modules.ExpoModulesPackage"), "UTF-8")
                    println "Patched PackageList.java: expo.core -> expo.modules"
                }
            }
        }
    }
}

`;
  let content = fs.readFileSync(appBuildGradle, "utf8");
  if (!content.includes("expo.core.ExpoModulesPackage")) {
    content = content.replace(/(\ndependencies\s*\{)/, gradlePatch + "$1");
    fs.writeFileSync(appBuildGradle, content);
    console.log("Injected PackageList.java workaround into app/build.gradle.");
  }
}

console.log("\nStep 2: Building release APK with Gradle...");
execSync(isWin ? "gradlew.bat assembleRelease" : "./gradlew assembleRelease", {
  cwd: androidDir,
  stdio: "inherit",
});

const apkPath = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk"
);
if (fs.existsSync(apkPath)) {
  console.log("\nAPK created:", apkPath);
} else {
  console.warn("\nAPK may be in a different path; check android/app/build/outputs/apk/");
}
