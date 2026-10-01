// Mount the browser-only application and its locally bundled styles.
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
mount(App, { target: document.getElementById('app') ?? document.body });
