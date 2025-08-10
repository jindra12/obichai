import { toChecksumAddress, privateToPublic, publicToAddress, bufferToHex } from "ethereumjs-util";
import { randomBytes } from "crypto";

export const generateWallet = () => {
  const privateKey = randomBytes(32);
  const publicKey = privateToPublic(privateKey);
  const addressBuffer = publicToAddress(publicKey);
  const address = toChecksumAddress(bufferToHex(addressBuffer));

  return {
    privateKey: bufferToHex(privateKey),
    publicKey: bufferToHex(publicKey),
    address
  };
}
