@echo off
SETLOCAL EnableDelayedExpansion

:: ==========================================
:: Requirements Maker Deployment Script (Smart Version)
:: ==========================================

:: Configuration
SET STACK_NAME=requirements-maker-dev
SET REGION=ap-northeast-1
SET PROFILE=default
SET STAGE=dev

:: Initialize Flags
SET SKIP_INFRA=1
SET SKIP_BACKEND=1
SET SKIP_FRONTEND=1
SET BACKEND_INSTALL=0
SET FRONTEND_INSTALL=0
SET FORCE_ALL=0

:: Parse Arguments
:args_loop
if "%~1"=="" goto args_done
if "%~1"=="--force" SET FORCE_ALL=1
if "%~1"=="--infra" SET SKIP_INFRA=0
if "%~1"=="--backend" SET SKIP_BACKEND=0
if "%~1"=="--frontend" SET SKIP_FRONTEND=0
if "%~1"=="--skip-infra" SET SKIP_INFRA=1
if "%~1"=="--skip-backend" SET SKIP_BACKEND=1
if "%~1"=="--skip-frontend" SET SKIP_FRONTEND=1
shift
goto args_loop
:args_done

:: Auto-detection Logic
if %FORCE_ALL%==1 (
    echo [INFO] Force deployment mode (--force)
    SET SKIP_INFRA=0
    SET SKIP_BACKEND=0
    SET SKIP_FRONTEND=0
    SET BACKEND_INSTALL=1
    SET FRONTEND_INSTALL=1
) else (
    echo [INFO] Detecting changes...
    
    where git >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        :: Get changed files
        SET "CHANGES="
        for /f "tokens=*" %%i in ('git diff --name-only') do SET "CHANGES=!CHANGES! %%i"
        for /f "tokens=*" %%i in ('git diff --cached --name-only') do SET "CHANGES=!CHANGES! %%i"
        for /f "tokens=*" %%i in ('git diff --name-only HEAD~1 HEAD 2^>nul') do SET "CHANGES=!CHANGES! %%i"

        :: Infrastructure
        echo !CHANGES! | findstr /r "infrastructure/" >nul
        if !ERRORLEVEL! equ 0 (
            echo  - [DETECTED] Infrastructure changes
            SET SKIP_INFRA=0
        )

        :: Backend
        echo !CHANGES! | findstr /r "backend/" >nul
        if !ERRORLEVEL! equ 0 (
            echo  - [DETECTED] Backend changes
            SET SKIP_BACKEND=0
        )
        echo !CHANGES! | findstr /r "backend/package.json backend/package-lock.json" >nul
        if !ERRORLEVEL! equ 0 (
            echo  - [DETECTED] Backend dependency changes (will run npm install)
            SET BACKEND_INSTALL=1
        )

        :: Frontend
        echo !CHANGES! | findstr /r "frontend/" >nul
        if !ERRORLEVEL! equ 0 (
            echo  - [DETECTED] Frontend changes
            SET SKIP_FRONTEND=0
        )
        echo !CHANGES! | findstr /r "frontend/package.json frontend/package-lock.json" >nul
        if !ERRORLEVEL! equ 0 (
            echo  - [DETECTED] Frontend dependency changes (will run npm install)
            SET FRONTEND_INSTALL=1
        )
    ) else (
        echo [WARNING] Git not found. Targeting all components.
        SET SKIP_INFRA=0
        SET SKIP_BACKEND=0
        SET SKIP_FRONTEND=0
    )
)

:: Force install if node_modules missing
if not exist backend\node_modules SET BACKEND_INSTALL=1
if not exist frontend\node_modules SET FRONTEND_INSTALL=1

:: Exit if no changes
if %SKIP_INFRA%==1 if %SKIP_BACKEND%==1 if %SKIP_FRONTEND%==1 (
    echo [INFO] No changes detected. Exiting.
    echo (Use --force to override)
    exit /b 0
)

echo ==========================================
echo [1/8] Prep: Getting Account Info
echo ==========================================
for /f "usebackq tokens=*" %%i in (`aws sts get-caller-identity --query "Account" --output text --profile %PROFILE%`) do SET ACCOUNT_ID=%%i
SET CODE_BUCKET=%STACK_NAME%-lambda-code-%ACCOUNT_ID%

if %SKIP_INFRA%==0 (
    echo Checking bucket: %CODE_BUCKET%
    aws s3 mb s3://%CODE_BUCKET% --region %REGION% --profile %PROFILE% 2>nul

    if not exist backend_dummy.zip (
        echo dummy > dummy.txt
        powershell -Command "Compress-Archive -Path dummy.txt -DestinationPath backend_dummy.zip -Force"
        del dummy.txt
    )
    aws s3 cp backend_dummy.zip s3://%CODE_BUCKET%/backend.zip --profile %PROFILE%

    echo.
    echo ==========================================
    echo [2/8] Infrastructure Update (CloudFormation)
    echo ==========================================
    aws cloudformation deploy ^
      --stack-name %STACK_NAME% ^
      --template-file infrastructure/cloudformation/main.yaml ^
      --parameter-overrides Environment=dev DBPassword=ReqMakerSecurePass2025 LambdaCodeBucketName=%CODE_BUCKET% ^
      --capabilities CAPABILITY_IAM ^
      --profile %PROFILE%
) else (
    echo [SKIP] Skipping Infrastructure update
)

echo.
echo ==========================================
echo [3/8] Getting AWS Resource Info
echo ==========================================
for /f "usebackq tokens=*" %%i in (`powershell -Command "aws cloudformation describe-stacks --stack-name %STACK_NAME% --query 'Stacks[0].Outputs[?OutputKey==''FrontendBucketName''].OutputValue' --output text --profile %PROFILE%"`) do SET S3_BUCKET=%%i
for /f "usebackq tokens=*" %%i in (`powershell -Command "aws cloudformation describe-stacks --stack-name %STACK_NAME% --query 'Stacks[0].Outputs[?OutputKey==''CloudFrontDistributionId''].OutputValue' --output text --profile %PROFILE%"`) do SET CF_DIST_ID=%%i
for /f "usebackq tokens=*" %%i in (`powershell -Command "aws cloudformation describe-stacks --stack-name %STACK_NAME% --query 'Stacks[0].Outputs[?OutputKey==''RestApiUrl''].OutputValue' --output text --profile %PROFILE%"`) do SET API_URL=%%i
for /f "usebackq tokens=*" %%i in (`powershell -Command "aws cloudformation describe-stacks --stack-name %STACK_NAME% --query 'Stacks[0].Outputs[?OutputKey==''WebSocketApiUrl''].OutputValue' --output text --profile %PROFILE%"`) do SET WS_URL=%%i

echo S3 Bucket: %S3_BUCKET%
echo API URL: %API_URL%

if %SKIP_BACKEND%==0 (
    echo.
    echo ==========================================
    echo [4/8] Building Backend
    echo ==========================================
    pushd backend
    if %BACKEND_INSTALL%==1 (
        echo Installing dependencies...
        call npm install
    )
    call npm run build

    echo Creating deployment package...
    if exist deploy_temp rmdir /s /q deploy_temp
    mkdir deploy_temp
    xcopy /s /e dist deploy_temp\dist\ > nul
    xcopy /s /e migrations deploy_temp\migrations\ > nul
    copy package.json deploy_temp\ > nul
    copy package-lock.json deploy_temp\ > nul

    pushd deploy_temp
    call npm install --production --no-package-lock
    powershell -Command "Compress-Archive -Path dist, node_modules, migrations -DestinationPath ..\backend_optimized.zip -Force"
    popd
    rmdir /s /q deploy_temp
    popd

    echo.
    echo ==========================================
    echo [5/8] Uploading Backend Code
    echo ==========================================
    aws s3 cp backend/backend_optimized.zip s3://%CODE_BUCKET%/backend.zip --profile %PROFILE%

    echo.
    echo ==========================================
    echo [6/8] Updating Lambda Functions
    echo ==========================================
    aws lambda update-function-code --function-name %STACK_NAME%-api --s3-bucket %CODE_BUCKET% --s3-key backend.zip --profile %PROFILE% > nul
    aws lambda update-function-code --function-name %STACK_NAME%-websocket --s3-bucket %CODE_BUCKET% --s3-key backend.zip --profile %PROFILE% > nul
) else (
    echo [SKIP] Skipping Backend update
)

if %SKIP_FRONTEND%==0 (
    echo.
    echo ==========================================
    echo [7/8] Building Frontend
    echo ==========================================
    pushd frontend
    SET REACT_APP_API_URL=%API_URL%
    SET REACT_APP_WS_URL=%WS_URL%
    if %FRONTEND_INSTALL%==1 (
        echo Installing dependencies...
        call npm install --legacy-peer-deps
    )
    call npm run build
    popd

    echo.
    echo ==========================================
    echo [8/8] Deploying Frontend (S3 Sync)
    echo ==========================================
    aws s3 sync frontend/build s3://%S3_BUCKET% --delete --profile %PROFILE%
    aws cloudfront create-invalidation --distribution-id %CF_DIST_ID% --paths "/*" --profile %PROFILE% > nul
) else (
    echo [SKIP] Skipping Frontend update
)

echo.
echo ==========================================
echo Deployment Complete!
echo ==========================================
pause
