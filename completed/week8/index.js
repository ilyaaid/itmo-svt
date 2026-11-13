import express from "express";
import bodyParser from "body-parser";
import { createReadStream } from "node:fs";
import crypto from "node:crypto";
import http from "node:http";
import mongodb from "mongodb";
import pug from "pug";
import puppeteer from "puppeteer";
import appSrc from "./app.js";

const app = appSrc(express, bodyParser, createReadStream, crypto, http, mongodb.MongoClient, pug, fetch, puppeteer);

app.listen(process.env.PORT || 3000);
