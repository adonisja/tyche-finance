import React from 'react'
import { createRoot } from 'react-dom/client'
import { configureAmplify } from './config/aws-config'
import App from './App'
import './index.css'

// Configure AWS Amplify BEFORE rendering React app
configureAmplify()

const root = createRoot(document.getElementById('root')!)
root.render(<React.StrictMode><App /></React.StrictMode>)
