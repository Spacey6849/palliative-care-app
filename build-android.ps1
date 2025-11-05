# Build Android app with Java 17
# This script ensures the correct Java version is used

Write-Host "Setting Java 17..." -ForegroundColor Green
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:Path = "C:\Program Files\Java\jdk-17\bin;$env:Path"

# Verify Java version
Write-Host "`nJava version:" -ForegroundColor Yellow
java -version

Write-Host "`nBuilding Android app..." -ForegroundColor Green
npx expo run:android --port 8082

Write-Host "`nBuild complete!" -ForegroundColor Green
