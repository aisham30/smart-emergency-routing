const network = {
  CC: {
    N1: 5,
    F1: 8,
    P1: 12
  },

  N1: {
    CC: 5,
    H1: 7,
    H2: 10,
    R1: 12
  },

  F1: {
    CC: 8,
    H1: 6,
    P1: 7
  },

  P1: {
    CC: 12,
    F1: 7,
    R2: 8
  },

  H1: {
    N1: 7,
    F1: 6,
    H2: 5
  },

  H2: {
    N1: 10,
    H1: 5,
    R1: 6
  },

  R1: {
    N1: 12,
    H2: 6,
    R2: 4
  },

  R2: {
    P1: 8,
    R1: 4
  }
};

module.exports = network;