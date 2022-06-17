import filterTests from "../support/filterTests"
const interact = require('../support/interact')

filterTests(['smoke', 'all'], () => {
  context("Auto Screens UI", () => {
    before(() => {
      cy.login()
    })

    it("should disable the autogenerated screen options if no sources are available", () => {
      cy.createApp("First Test App", false)
      
      cy.closeModal();

      cy.contains("Design").click()
      cy.get(interact.LABEL_ADD_CIRCLE).click()
      cy.get(interact.SPECTRUM_MODAL).within(() => {
        cy.get(interact.ITEM_DISABLED).contains("Autogenerated screens")
        cy.get(interact.CONFIRM_WRAP_SPE_BUTTON).should('be.disabled')
      })

      cy.deleteAllApps()
    });

    it("should not display incompatible sources", () => {
      cy.createApp("Test App")

      cy.selectExternalDatasource("REST")
      cy.selectExternalDatasource("S3")
      cy.get(interact.SPECTRUM_MODAL).within(() => {
        cy.get(interact.SPECTRUM_BUTTON).contains("Save and continue to query").click({ force : true })
      })
      
      cy.navigateToAutogeneratedModal()

      cy.get(interact.DATA_SOURCE_ENTRY).should('have.length', 1)
      cy.get(interact.DATA_SOURCE_ENTRY)

      cy.deleteAllApps()
    });
      
    it("should generate internal table screens", () => {
      cy.createTestApp()
      // Create Autogenerated screens from the internal table
      cy.createDatasourceScreen(["Cypress Tests"])
      // Confirm screens have been auto generated
      cy.get(interact.NAV_ITEMS_CONTAINER).contains("cypress-tests").click({ force: true })
      cy.get(interact.NAV_ITEMS_CONTAINER).should('contain', 'cypress-tests/:id')
        .and('contain', 'cypress-tests/new/row')
    })

    it("should generate multiple internal table screens at once", () => {
      // Create a second internal table
      const initialTable = "Cypress Tests"
      const secondTable = "Table Two"
      cy.createTable(secondTable)
      // Create Autogenerated screens from the internal tables
      cy.createDatasourceScreen([initialTable, secondTable])
      // Confirm screens have been auto generated
      cy.get(interact.NAV_ITEMS_CONTAINER).contains("cypress-tests").click({ force: true })
      // Previously generated tables are suffixed with numbers - as expected
      cy.get(interact.NAV_ITEMS_CONTAINER).should('contain', 'cypress-tests-2/:id')
        .and('contain', 'cypress-tests-2/new/row')
      cy.get(interact.NAV_ITEMS_CONTAINER).contains("table-two").click()
      cy.get(interact.NAV_ITEMS_CONTAINER).should('contain', 'table-two/:id')
        .and('contain', 'table-two/new/row')
    })

    it("should generate multiple internal table screens with the same screen access level", () => {
      //The tables created in the previous step still exist
      cy.createTable("Table Three")
      cy.createTable("Table Four")
      cy.createDatasourceScreen(["Table Three", "Table Four"], "Admin")

      cy.get(interact.NAV_ITEMS_CONTAINER).contains("table-three").click()
      cy.get(interact.NAV_ITEMS_CONTAINER).should('contain', 'table-three/:id')
      .and('contain', 'table-three/new/row')

      cy.get(interact.NAV_ITEMS_CONTAINER).contains("table-four").click()
      cy.get(interact.NAV_ITEMS_CONTAINER).should('contain', 'table-four/:id')
      .and('contain', 'table-four/new/row')

      //The access level should now be set to admin. Previous screens should be filtered.
      cy.get(interact.NAV_ITEMS_CONTAINER).contains("table-two").should('not.exist')
      cy.get(interact.NAV_ITEMS_CONTAINER).contains("cypress-tests").should('not.exist')
    })

    if (Cypress.env("TEST_ENV")) {
      it("should generate data source screens", () => {
        // Using MySQL data source for testing this
        const datasource = "MySQL"
        // Select & configure MySQL data source
        cy.selectExternalDatasource(datasource)
        cy.addDatasourceConfig(datasource)
        // Create Autogenerated screens from a MySQL table - MySQL contains books table
        cy.createDatasourceScreen(["books"])
        
        cy.get(interact.NAV_ITEMS_CONTAINER).contains("books").click()
        cy.get(interact.NAV_ITEMS_CONTAINER).should('contain', 'books/:id')
          .and('contain', 'books/new/row')
      })
    }
  })
})
