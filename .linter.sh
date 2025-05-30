#!/bin/bash
cd /home/kavia/workspace/code-generation/habitglow-23540-9cefdc31/habitglow_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

