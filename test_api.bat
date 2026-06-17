@echo off
curl.exe -s -X POST https://free-generate-image.den-fstack.workers.dev/ -H "Authorization: Bearer ***" -H "Content-Type: application/json" -d @test_body.json -o test_wh.png -w "%%{http_code}"
echo Exit: %ERRORLEVEL%
if exist test_wh.png dir test_wh.png
