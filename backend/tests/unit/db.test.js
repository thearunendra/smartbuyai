// connectDB: no URI, success, the public-DNS retry for SRV lookups, and
// failures. mongoose.connect is mocked; no database is used.

const dns = require("dns");
const mongoose = require("mongoose");
const { connectDB, isDBReady } = require("../../db");

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(dns, "setServers").mockImplementation(() => {});
  process.env.MONGODB_URI = "mongodb+srv://user:pass@cluster.example/";
});

afterEach(() => {
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB;
});

test("is off without MONGODB_URI", async () => {
  delete process.env.MONGODB_URI;
  const connect = jest.spyOn(mongoose, "connect");

  await expect(connectDB()).resolves.toBe(false);
  expect(connect).not.toHaveBeenCalled();
});

test("connects with the default database name", async () => {
  const connect = jest.spyOn(mongoose, "connect").mockResolvedValue(mongoose);

  await expect(connectDB()).resolves.toBe(true);
  expect(connect).toHaveBeenCalledWith(process.env.MONGODB_URI, {
    dbName: "smartbuy",
    serverSelectionTimeoutMS: 10000
  });
});

test("uses MONGODB_DB when set", async () => {
  process.env.MONGODB_DB = "custom";
  const connect = jest.spyOn(mongoose, "connect").mockResolvedValue(mongoose);

  await connectDB();

  expect(connect.mock.calls[0][1].dbName).toBe("custom");
});

test("retries with public DNS when the SRV lookup is refused", async () => {
  const connect = jest
    .spyOn(mongoose, "connect")
    .mockRejectedValueOnce(new Error("querySrv ECONNREFUSED _mongodb._tcp.cluster"))
    .mockResolvedValueOnce(mongoose);

  await expect(connectDB()).resolves.toBe(true);
  expect(dns.setServers).toHaveBeenCalledWith(["8.8.8.8", "1.1.1.1"]);
  expect(connect).toHaveBeenCalledTimes(2);
});

test("gives up when the retry fails too", async () => {
  jest
    .spyOn(mongoose, "connect")
    .mockRejectedValueOnce(new Error("querySrv ECONNREFUSED"))
    .mockRejectedValueOnce(new Error("still failing"));

  await expect(connectDB()).resolves.toBe(false);
  expect(console.log).toHaveBeenCalledWith("Database: unable to connect -", "still failing");
});

test("doesn't retry other errors", async () => {
  const connect = jest
    .spyOn(mongoose, "connect")
    .mockRejectedValueOnce(new Error("bad auth"));

  await expect(connectDB()).resolves.toBe(false);
  expect(connect).toHaveBeenCalledTimes(1);
  expect(dns.setServers).not.toHaveBeenCalled();
});

test("isDBReady follows the connection state", () => {
  expect(isDBReady()).toBe(false);
});
